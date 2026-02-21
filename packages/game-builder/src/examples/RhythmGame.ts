/**
 * RhythmGame - Beat-matching rhythm game
 *
 * Hit notes in time with the beat to build combos and score big!
 * Demonstrates:
 * - Timing-based gameplay with precision windows
 * - Combo multiplier system
 * - Difficulty tiers that scale note speed and density
 * - Competitive scoring between players
 *
 * WHY rhythm games work:
 * Rhythm games tap into a fundamental human (and AI) satisfaction: pattern
 * recognition and execution. The "flow state" comes from matching input to
 * a predictable sequence at increasing speed. For AI agents, this becomes
 * an interesting optimization problem — can the bot learn the timing windows
 * and maximize combo chains?
 *
 * WHY combo multipliers feel satisfying:
 * Combos create exponential reward for consistent play. Missing one note
 * resets the multiplier, making each hit feel high-stakes. This turns a
 * simple "hit the button" game into a tension-filled performance where
 * every note matters. The combo counter is also a visible progress metric
 * that gives players a sense of mastery.
 *
 * This is a ~200 line complete game that bots can study and modify.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface RhythmConfig {
  songLengthBeats?: number;
  bpm?: number;
  difficulty?: 'easy' | 'normal' | 'hard';
  /** Number of note lanes (3-6, default 4). */
  lanes?: number;
  /** Note speed: slow = 2x wider windows, fast = 0.5x narrower (default 'medium'). */
  noteSpeed?: 'slow' | 'medium' | 'fast';
  /** Max misses before forced game over (0 = unlimited, default 0). */
  missLimit?: number;
  secondaryMechanic?: 'rhythm' | 'puzzle' | 'timing' | 'resource';

  /** Visual theming options. */
  theme?: {
    /** Color per lane, e.g. ['#FF0000','#00FF00','#0000FF','#FFFF00'] (default: auto-generated). */
    laneColors?: string[];
    /** Flash color when a note is hit (CSS, default '#FFFFFF'). */
    hitFlashColor?: string;
    /** Colors for each hit rating: { perfect, good, ok } (CSS, default: gold/green/gray). */
    ratingColors?: { perfect?: string; good?: string; ok?: string };
  };

  /** Gameplay tuning options. */
  gameplay?: {
    /** Timing window thresholds in beats: { perfect, good, ok } (default: 0.5/1.0/2.0). */
    timingWindows?: { perfect?: number; good?: number; ok?: number };
    /** Score values per hit rating: { perfect, good, ok, miss } (default: 300/200/100/0). */
    scoreValues?: { perfect?: number; good?: number; ok?: number; miss?: number };
    /** Combo multiplier cap (default 4). */
    comboMultiplier?: number;
  };
}

/**
 * Note lanes (like Guitar Hero's colored frets).
 * WHY 4 lanes: Fewer than 3 feels trivial. More than 5 becomes overwhelming.
 * 4 lanes hit the sweet spot where players must divide attention without
 * feeling paralyzed by options. Configurable via RhythmConfig.lanes (2-6).
 */
type Lane = number;

interface Note {
  id: number;
  lane: Lane;
  beatTime: number; // The beat number when this note should be hit
  hit: boolean; // Whether the player has hit this note
  missed: boolean; // Whether the note was missed (passed the window)
}

/**
 * WHY timing windows need tuning: Too tight and the game feels unfair.
 * Too loose and there's no skill expression. Three tiers (Perfect/Good/OK)
 * reward precision while still giving partial credit for near-misses. This
 * keeps players engaged even when they're not performing optimally.
 */
type HitRating = 'perfect' | 'good' | 'ok' | 'miss';

interface RhythmState {
  [key: string]: unknown;
  notes: Note[]; // All notes in the song
  currentBeat: number; // Current beat position
  totalBeats: number; // Song length in beats
  bpm: number; // Beats per minute
  scores: Record<string, number>;
  combos: Record<string, number>; // Current combo streak
  maxCombos: Record<string, number>; // Best combo achieved
  multipliers: Record<string, number>; // Current score multiplier
  hitCounts: Record<string, Record<HitRating, number>>;
  difficulty: 'easy' | 'normal' | 'hard';
  nextNoteId: number;
  songComplete: boolean;
  totalLanes: number;
  noteSpeedMultiplier: number;
  missLimit: number; // 0 = unlimited
  totalMisses: Record<string, number>; // Per-player total miss count
}

/**
 * Timing window thresholds (in beats).
 * WHY these specific values: Perfect requires hitting within 0.1 beats of
 * the target — about 50ms at 120 BPM. Good is 0.25 beats (~125ms), and OK
 * is 0.5 beats (~250ms). These windows are calibrated so that Perfect feels
 * like a real achievement, Good feels fair, and OK is the "at least you tried"
 * safety net that prevents frustration.
 */
const DEFAULT_TIMING_WINDOWS = {
  perfect: 0.5,
  good: 1.0,
  ok: 2.0,
};

const DEFAULT_SCORE_VALUES: Record<HitRating, number> = {
  perfect: 300,
  good: 200,
  ok: 100,
  miss: 0,
};

const DEFAULT_COMBO_MULTIPLIER_CAP = 4;

/**
 * WHY difficulty tiers retain players: Easy mode lets new players experience
 * the full song without frustration. Hard mode challenges veterans with dense
 * note patterns. Without difficulty options, you either bore experts or
 * frustrate beginners — both cause players to quit.
 */
const DIFFICULTY_NOTE_DENSITY: Record<string, number> = {
  easy: 0.3, // 30% of beats have notes
  normal: 0.5, // 50% of beats have notes
  hard: 0.75, // 75% of beats have notes
};

export class RhythmGame extends BaseGame {
  readonly name = 'Beat Blaster';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): RhythmState {
    const cfg = this.config as RhythmConfig;
    const songLengthBeats = cfg.songLengthBeats ?? 64;
    const bpm = cfg.bpm ?? 120;
    const difficulty = cfg.difficulty ?? 'normal';
    const totalLanes = Math.max(3, Math.min(cfg.lanes ?? 4, 6));
    const speedMap: Record<string, number> = { slow: 0.5, medium: 1.0, fast: 2.0 };
    const noteSpeedMultiplier = speedMap[cfg.noteSpeed ?? 'medium'] ?? 1.0;
    const missLimit = Math.max(0, cfg.missLimit ?? 0);
    const notes = this.generateNoteChart(difficulty, songLengthBeats, totalLanes);

    const scores: Record<string, number> = {};
    const combos: Record<string, number> = {};
    const maxCombos: Record<string, number> = {};
    const multipliers: Record<string, number> = {};
    const hitCounts: Record<string, Record<HitRating, number>> = {};
    const totalMisses: Record<string, number> = {};

    for (const pid of playerIds) {
      scores[pid] = 0;
      combos[pid] = 0;
      maxCombos[pid] = 0;
      multipliers[pid] = 1;
      hitCounts[pid] = { perfect: 0, good: 0, ok: 0, miss: 0 };
      totalMisses[pid] = 0;
    }

    return {
      notes,
      currentBeat: 0,
      totalBeats: songLengthBeats,
      bpm,
      scores,
      combos,
      maxCombos,
      multipliers,
      hitCounts,
      difficulty,
      nextNoteId: notes.length + 1,
      songComplete: false,
      totalLanes,
      noteSpeedMultiplier,
      missLimit,
      totalMisses,
      upcomingNotes: this.getUpcomingNotes({
        notes,
        currentBeat: 0,
        totalBeats: songLengthBeats,
        bpm,
        scores,
        combos,
        maxCombos,
        multipliers,
        hitCounts,
        difficulty,
        nextNoteId: notes.length + 1,
        songComplete: false,
        totalLanes,
        noteSpeedMultiplier,
        missLimit,
        totalMisses,
      }),
    };
  }

  private getTimingWindows(): { perfect: number; good: number; ok: number } {
    const cfg = this.config as RhythmConfig;
    return {
      perfect: (cfg.gameplay?.timingWindows?.perfect as number) ?? DEFAULT_TIMING_WINDOWS.perfect,
      good: (cfg.gameplay?.timingWindows?.good as number) ?? DEFAULT_TIMING_WINDOWS.good,
      ok: (cfg.gameplay?.timingWindows?.ok as number) ?? DEFAULT_TIMING_WINDOWS.ok,
    };
  }

  private getScoreValues(): Record<HitRating, number> {
    const cfg = this.config as RhythmConfig;
    return {
      perfect: (cfg.gameplay?.scoreValues?.perfect as number) ?? DEFAULT_SCORE_VALUES.perfect,
      good: (cfg.gameplay?.scoreValues?.good as number) ?? DEFAULT_SCORE_VALUES.good,
      ok: (cfg.gameplay?.scoreValues?.ok as number) ?? DEFAULT_SCORE_VALUES.ok,
      miss: (cfg.gameplay?.scoreValues?.miss as number) ?? DEFAULT_SCORE_VALUES.miss,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<RhythmState>();
    const timingWindows = this.getTimingWindows();
    const scoreValues = this.getScoreValues();
    const cfg = this.config as RhythmConfig;
    const comboMultiplierCap =
      (cfg.gameplay?.comboMultiplier as number) ?? DEFAULT_COMBO_MULTIPLIER_CAP;

    switch (action.type) {
      /**
       * Advance the song by one beat.
       * Any notes that pass beyond the OK window become misses.
       * WHY auto-miss on advance: This creates time pressure even in a
       * turn-based system. Players can't wait forever — they must act
       * within the window or lose their combo.
       */
      case 'beat':
      case 'advance_beat': {
        data.currentBeat++;
        const okWindow = timingWindows.ok / data.noteSpeedMultiplier;

        // Check for missed notes (past the OK window)
        for (const note of data.notes) {
          if (!note.hit && !note.missed && data.currentBeat - note.beatTime >= okWindow) {
            note.missed = true;
            // All players miss this note if they haven't hit it
            for (const pid of this.getPlayers()) {
              data.hitCounts[pid].miss++;
              data.totalMisses[pid]++;
              data.combos[pid] = 0;
              data.multipliers[pid] = 1;
            }
            this.emitEvent('note_missed', undefined, { noteId: note.id, lane: note.lane });
          }
        }

        // Check if song is complete
        if (data.currentBeat >= data.totalBeats) {
          data.songComplete = true;
        }

        // Check missLimit game over
        if (data.missLimit > 0) {
          for (const pid of this.getPlayers()) {
            if (data.totalMisses[pid] >= data.missLimit) {
              data.songComplete = true;
            }
          }
        }

        (data as Record<string, unknown>).upcomingNotes = this.getUpcomingNotes(data);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Hit a note in a specific lane.
       * WHY per-player hit tracking: Each player independently hits notes,
       * so the same note chart supports competitive play. Player A might
       * Perfect a note that Player B only gets a Good on, creating
       * score differentiation from skill, not luck.
       */
      case 'hit':
      case 'tap':
      case 'hit_note': {
        // Auto-advance beat so testers don't need separate advance_beat calls
        data.currentBeat++;
        const hitOkWindow = timingWindows.ok / data.noteSpeedMultiplier;

        // Check for missed notes (past the OK window) on beat advance
        for (const note of data.notes) {
          if (!note.hit && !note.missed && data.currentBeat - note.beatTime > hitOkWindow) {
            note.missed = true;
            for (const pid of this.getPlayers()) {
              data.hitCounts[pid].miss++;
              data.totalMisses[pid]++;
              data.combos[pid] = 0;
              data.multipliers[pid] = 1;
            }
            this.emitEvent('note_missed', undefined, { noteId: note.id, lane: note.lane });
          }
        }

        // Check if song is complete
        if (data.currentBeat >= data.totalBeats) {
          data.songComplete = true;
        }

        // Check missLimit game over
        if (data.missLimit > 0) {
          for (const pid of this.getPlayers()) {
            if (data.totalMisses[pid] >= data.missLimit) {
              data.songComplete = true;
            }
          }
        }

        const lane = action.payload.lane != null ? (Number(action.payload.lane) as Lane) : null;

        // Validate lane bounds
        if (lane != null && (lane < 0 || lane >= data.totalLanes)) {
          this.setData(data);
          return { success: false, error: `Invalid lane: must be 0 to ${data.totalLanes - 1}` };
        }

        // Find the closest unhit note within the OK window
        // First try the specified lane, then fall back to any lane
        let closestNote: Note | null = null;
        let closestDistance = Infinity;

        for (const note of data.notes) {
          if (note.hit || note.missed) continue;
          if (lane != null && note.lane !== lane) continue;

          const distance = Math.abs(data.currentBeat - note.beatTime);
          if (distance <= hitOkWindow && distance < closestDistance) {
            closestNote = note;
            closestDistance = distance;
          }
        }

        // If lane was specified but nothing found, try any lane
        if (!closestNote && lane != null) {
          for (const note of data.notes) {
            if (note.hit || note.missed) continue;

            const distance = Math.abs(data.currentBeat - note.beatTime);
            if (distance <= hitOkWindow && distance < closestDistance) {
              closestNote = note;
              closestDistance = distance;
            }
          }
        }

        if (!closestNote) {
          // No note to hit: "ghost tap" (no penalty, but no reward)
          this.emitEvent('ghost_tap', playerId, {
            currentBeat: data.currentBeat,
            upcomingNotes: this.getUpcomingNotes(data, 3),
            hint: 'No note in range. Next notes listed in upcomingNotes.',
          });
          (data as Record<string, unknown>).upcomingNotes = this.getUpcomingNotes(data);
          this.setData(data);
          return { success: true, newState: this.getState() };
        }

        // Rate the hit based on timing precision, scaled by noteSpeed
        const rating = this.rateHit(closestDistance, data.noteSpeedMultiplier);

        if (rating === 'miss') {
          // Somehow in window but rated miss — shouldn't happen but handle it
          data.combos[playerId] = 0;
          data.multipliers[playerId] = 1;
        } else {
          closestNote.hit = true;

          // Update combo
          /**
           * WHY combo multiplier caps at 4x: Uncapped multipliers would make
           * early misses feel devastating (the score gap becomes insurmountable).
           * A 4x cap means even after building a huge combo, the score advantage
           * stays within reach — a well-played finish can still overtake.
           */
          data.combos[playerId]++;
          data.maxCombos[playerId] = Math.max(data.maxCombos[playerId], data.combos[playerId]);
          data.multipliers[playerId] = Math.min(
            comboMultiplierCap,
            1 + Math.floor(data.combos[playerId] / 10),
          );

          // Calculate score
          const noteScore = scoreValues[rating] * data.multipliers[playerId];
          data.scores[playerId] += noteScore;
          data.hitCounts[playerId][rating]++;

          this.emitEvent('note_hit', playerId, {
            noteId: closestNote.id,
            lane,
            rating,
            score: noteScore,
            combo: data.combos[playerId],
            multiplier: data.multipliers[playerId],
          });
        }

        (data as Record<string, unknown>).upcomingNotes = this.getUpcomingNotes(data);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Change difficulty mid-game (for practice/adaptive difficulty).
       * WHY adaptive difficulty: Some rhythm games adjust difficulty based on
       * player performance. Exposing this as an action lets bot creators
       * experiment with adaptive difficulty algorithms.
       */
      case 'set_difficulty': {
        const newDifficulty = String(action.payload.difficulty);
        if (!['easy', 'normal', 'hard'].includes(newDifficulty)) {
          return { success: false, error: 'Invalid difficulty (easy/normal/hard)' };
        }

        data.difficulty = newDifficulty as RhythmState['difficulty'];
        // Regenerate note chart with the new difficulty
        data.notes = this.generateNoteChart(newDifficulty, data.totalBeats, data.totalLanes);
        data.nextNoteId = data.notes.length + 1;
        this.emitEvent('difficulty_changed', playerId, { difficulty: newDifficulty });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<RhythmState>();
    return data.songComplete;
  }

  protected determineWinner(): string | null {
    const data = this.getData<RhythmState>();

    let bestPlayer: string | null = null;
    let bestScore = -1;
    for (const pid of this.getPlayers()) {
      if (data.scores[pid] > bestScore) {
        bestScore = data.scores[pid];
        bestPlayer = pid;
      }
    }
    return bestPlayer;
  }

  /**
   * WHY scoring factors in accuracy AND combos: Pure score rewards combo
   * builders. The accuracy percentage breaks ties when two players have
   * similar scores. Max combo is a "bragging rights" stat that players
   * compare, adding social competition even in single-player.
   */
  protected calculateScores(): Record<string, number> {
    const data = this.getData<RhythmState>();
    const scores: Record<string, number> = {};

    for (const pid of this.getPlayers()) {
      const totalHits =
        data.hitCounts[pid].perfect + data.hitCounts[pid].good + data.hitCounts[pid].ok;
      const totalNotes = totalHits + data.hitCounts[pid].miss;
      const accuracyBonus = totalNotes > 0 ? Math.floor((totalHits / totalNotes) * 500) : 0;
      const comboBonus = data.maxCombos[pid] * 10;

      scores[pid] = data.scores[pid] + accuracyBonus + comboBonus;
    }

    return scores;
  }

  /**
   * Rate a hit based on timing distance from the target beat.
   */
  private rateHit(distance: number, speedMultiplier = 1): HitRating {
    const tw = this.getTimingWindows();
    if (distance <= tw.perfect / speedMultiplier) return 'perfect';
    if (distance <= tw.good / speedMultiplier) return 'good';
    if (distance <= tw.ok / speedMultiplier) return 'ok';
    return 'miss';
  }

  /**
   * Return the next N unhit/unmissed notes sorted by beat time.
   */
  private getUpcomingNotes(
    data: RhythmState,
    count = 5,
  ): { id: number; lane: number; beatTime: number }[] {
    return data.notes
      .filter((n) => !n.hit && !n.missed)
      .sort((a, b) => a.beatTime - b.beatTime)
      .slice(0, count)
      .map((n) => ({ id: n.id, lane: n.lane, beatTime: n.beatTime }));
  }

  /**
   * Generate a note chart for the song.
   * WHY procedural generation: Handcrafted charts sound better but require
   * human effort. Procedural generation lets bots create infinite songs.
   * A well-tuned generator respects musical principles: notes cluster in
   * patterns, leave breathing room, and vary density to create dynamics.
   */
  private generateNoteChart(difficulty: string, songLengthBeats?: number, lanes = 4): Note[] {
    const totalBeats = songLengthBeats ?? 64;
    const notes: Note[] = [];
    const density = DIFFICULTY_NOTE_DENSITY[difficulty] || 0.5;
    let noteId = 1;

    for (let beat = 1; beat <= totalBeats; beat++) {
      // Use a deterministic pattern based on beat number for reproducibility
      // WHY deterministic: Random notes feel chaotic. Patterns based on beat
      // position create musical structure that feels intentional.
      if (this.shouldPlaceNote(beat, density)) {
        const lane = ((beat * 7 + Math.floor(beat / 4)) % lanes) as Lane;
        notes.push({
          id: noteId++,
          lane,
          beatTime: beat,
          hit: false,
          missed: false,
        });

        // On hard difficulty, add chord notes (multiple lanes at once)
        if (difficulty === 'hard' && beat % 8 === 0) {
          const secondLane = ((lane + Math.floor(lanes / 2)) % lanes) as Lane;
          notes.push({
            id: noteId++,
            lane: secondLane,
            beatTime: beat,
            hit: false,
            missed: false,
          });
        }
      }
    }

    return notes;
  }

  /**
   * Determine if a note should be placed at this beat.
   * Uses a simple hash-like function for deterministic but varied placement.
   */
  private shouldPlaceNote(beat: number, density: number): boolean {
    // Create a deterministic "random" value from the beat number
    const hash = ((beat * 2654435761) >>> 0) / 4294967296;
    return hash < density;
  }
}
