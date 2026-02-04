import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Initial MOLT supply: 1 billion tokens (with 18 decimals)
  const initialSupply = ethers.parseEther("1000000000");

  // 1. Deploy MOLT Token
  console.log("\n1. Deploying MoltToken...");
  const MoltToken = await ethers.getContractFactory("MoltToken");
  const moltToken = await MoltToken.deploy(initialSupply);
  await moltToken.waitForDeployment();
  const moltTokenAddress = await moltToken.getAddress();
  console.log("   MoltToken deployed to:", moltTokenAddress);

  // 2. Create Treasury address (for now, use deployer)
  // In production, this would be a multisig or DAO
  const treasuryAddress = deployer.address;
  console.log("\n2. Treasury address:", treasuryAddress);

  // 3. Deploy GameMarketplace
  console.log("\n3. Deploying GameMarketplace...");
  const GameMarketplace = await ethers.getContractFactory("GameMarketplace");
  const gameMarketplace = await GameMarketplace.deploy(moltTokenAddress, treasuryAddress);
  await gameMarketplace.waitForDeployment();
  const gameMarketplaceAddress = await gameMarketplace.getAddress();
  console.log("   GameMarketplace deployed to:", gameMarketplaceAddress);

  // 4. Deploy TournamentManager
  console.log("\n4. Deploying TournamentManager...");
  const TournamentManager = await ethers.getContractFactory("TournamentManager");
  const tournamentManager = await TournamentManager.deploy(moltTokenAddress, treasuryAddress);
  await tournamentManager.waitForDeployment();
  const tournamentManagerAddress = await tournamentManager.getAddress();
  console.log("   TournamentManager deployed to:", tournamentManagerAddress);

  // 5. Grant minter role to TournamentManager (for reward distribution)
  console.log("\n5. Setting up permissions...");
  await moltToken.addMinter(tournamentManagerAddress);
  console.log("   TournamentManager added as minter");

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(50));
  console.log("\nContract Addresses:");
  console.log("  MoltToken:         ", moltTokenAddress);
  console.log("  GameMarketplace:   ", gameMarketplaceAddress);
  console.log("  TournamentManager: ", tournamentManagerAddress);
  console.log("  Treasury:          ", treasuryAddress);
  console.log("\nRevenue Split:");
  console.log("  Creator:  85%");
  console.log("  Platform: 15%");
  console.log("\nTournament Prize Distribution (default):");
  console.log("  1st Place:     50%");
  console.log("  2nd Place:     25%");
  console.log("  3rd Place:     15%");
  console.log("  Participation: 10%");

  // Save deployment addresses to file
  const fs = await import("fs");
  const deploymentInfo = {
    network: "localhost",
    timestamp: new Date().toISOString(),
    contracts: {
      MoltToken: moltTokenAddress,
      GameMarketplace: gameMarketplaceAddress,
      TournamentManager: tournamentManagerAddress,
    },
    treasury: treasuryAddress,
    deployer: deployer.address,
  };

  fs.writeFileSync(
    "./deployments.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
