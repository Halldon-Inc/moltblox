import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("");
  console.log("=".repeat(55));
  console.log("  MOLTBLOX CONTRACT DEPLOYMENT");
  console.log("=".repeat(55));
  console.log(`  Network:  ${networkName} (Chain ID: ${network.config.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(balance)} ETH`);
  console.log("=".repeat(55));

  // Initial MBUCKS supply: 1 billion tokens (with 18 decimals)
  const initialSupply = ethers.parseEther("1000000000");

  // 1. Deploy Moltbucks Token
  console.log("\n1. Deploying Moltbucks...");
  const Moltbucks = await ethers.getContractFactory("Moltbucks");
  const moltbucks = await Moltbucks.deploy(initialSupply);
  await moltbucks.waitForDeployment();
  const moltbucksAddress = await moltbucks.getAddress();
  console.log("   Moltbucks deployed to:", moltbucksAddress);

  // 2. Treasury address — deployer for testnet, multisig for mainnet
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  console.log("\n2. Treasury address:", treasuryAddress);

  // 3. Deploy GameMarketplace
  console.log("\n3. Deploying GameMarketplace...");
  const GameMarketplace = await ethers.getContractFactory("GameMarketplace");
  const gameMarketplace = await GameMarketplace.deploy(moltbucksAddress, treasuryAddress);
  await gameMarketplace.waitForDeployment();
  const gameMarketplaceAddress = await gameMarketplace.getAddress();
  console.log("   GameMarketplace deployed to:", gameMarketplaceAddress);

  // 4. Deploy TournamentManager
  console.log("\n4. Deploying TournamentManager...");
  const TournamentManager = await ethers.getContractFactory("TournamentManager");
  const tournamentManager = await TournamentManager.deploy(moltbucksAddress, treasuryAddress);
  await tournamentManager.waitForDeployment();
  const tournamentManagerAddress = await tournamentManager.getAddress();
  console.log("   TournamentManager deployed to:", tournamentManagerAddress);

  // 5. Grant minter role to TournamentManager
  console.log("\n5. Setting up permissions...");
  const tx = await moltbucks.addMinter(tournamentManagerAddress);
  await tx.wait();
  console.log("   TournamentManager added as minter");

  // Summary
  console.log("\n" + "=".repeat(55));
  console.log("  DEPLOYMENT COMPLETE");
  console.log("=".repeat(55));
  console.log("\n  Contract Addresses:");
  console.log("    Moltbucks:         ", moltbucksAddress);
  console.log("    GameMarketplace:   ", gameMarketplaceAddress);
  console.log("    TournamentManager: ", tournamentManagerAddress);
  console.log("    Treasury:          ", treasuryAddress);
  console.log("\n  Revenue Split:  85% Creator / 15% Platform");
  console.log("  Prize Default:  50% 1st / 25% 2nd / 15% 3rd / 10% Participation");
  console.log("=".repeat(55));

  // Save deployment addresses
  const deploymentInfo = {
    network: networkName,
    chainId: network.config.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    treasury: treasuryAddress,
    contracts: {
      Moltbucks: {
        address: moltbucksAddress,
        initialSupply: "1000000000",
      },
      GameMarketplace: {
        address: gameMarketplaceAddress,
        creatorShare: 85,
        platformShare: 15,
      },
      TournamentManager: {
        address: tournamentManagerAddress,
        defaultDistribution: { first: 50, second: 25, third: 15, participation: 10 },
      },
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${networkName}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n  Deployment saved to: deployments/${filename}`);

  // Also save as latest for this network
  const latestPath = path.join(deploymentsDir, `${networkName}-latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`  Latest saved to:    deployments/${networkName}-latest.json`);

  // Generate .env snippet for easy copy-paste
  console.log("\n  Add to your .env:\n");
  console.log(`    NEXT_PUBLIC_MOLTBUCKS_ADDRESS=${moltbucksAddress}`);
  console.log(`    NEXT_PUBLIC_GAME_MARKETPLACE_ADDRESS=${gameMarketplaceAddress}`);
  console.log(`    NEXT_PUBLIC_TOURNAMENT_MANAGER_ADDRESS=${tournamentManagerAddress}`);

  // Verify on block explorer (skip for localhost/hardhat)
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\n  Verifying contracts on BaseScan...");

    try {
      await run("verify:verify", {
        address: moltbucksAddress,
        constructorArguments: [initialSupply],
      });
      console.log("    Moltbucks verified");
    } catch (e: any) {
      console.log("    Moltbucks verification:", e.message?.includes("Already") ? "already verified" : "failed");
    }

    try {
      await run("verify:verify", {
        address: gameMarketplaceAddress,
        constructorArguments: [moltbucksAddress, treasuryAddress],
      });
      console.log("    GameMarketplace verified");
    } catch (e: any) {
      console.log("    GameMarketplace verification:", e.message?.includes("Already") ? "already verified" : "failed");
    }

    try {
      await run("verify:verify", {
        address: tournamentManagerAddress,
        constructorArguments: [moltbucksAddress, treasuryAddress],
      });
      console.log("    TournamentManager verified");
    } catch (e: any) {
      console.log("    TournamentManager verification:", e.message?.includes("Already") ? "already verified" : "failed");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
