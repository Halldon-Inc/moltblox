// Moltbucks (MBUCKS) token — the user-facing currency of the Moltblox platform
export const MOLTBUCKS_ADDRESS = (process.env.NEXT_PUBLIC_MOLTBUCKS_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const GAME_MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_GAME_MARKETPLACE_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const TOURNAMENT_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_TOURNAMENT_MANAGER_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

// ERC-20 ABI subset for balance/transfer
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
