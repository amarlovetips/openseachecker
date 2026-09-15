const { ethers } = require('ethers');

async function testRareFriendsDetails() {
  const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com', {
    chainId: 4663,
    name: 'Robinhood'
  });

  const contractAddress = '0x116eaa62241751e0c98da43d458600c6c17cd361';
  console.log(`Checking NFT Contract: ${contractAddress} on Robinhood Chain...`);

  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function maxSupply() view returns (uint256)",
    "function mint(uint256 quantity) public payable",
    "function publicMint(uint256 quantity) public payable"
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);

  const [name, symbol, total] = await Promise.all([
    contract.name().catch(() => 'N/A'),
    contract.symbol().catch(() => 'N/A'),
    contract.totalSupply().catch(() => 'N/A')
  ]);

  console.log(`✅ Name: ${name}`);
  console.log(`✅ Symbol: ${symbol}`);
  console.log(`✅ Total Supply Minted: ${total}`);

  // Test SeaDrop link
  // Many OpenSea drops use SeaDrop or SeaDrop-compatible minter
  // Let's check SeaDrop getPublicDrop
  const seaDropAddress = '0x00005ea00ac477b1030ce7850649663527901b0c';
  const seaDropAbi = [
    "function getPublicDrop(address nftContract) view returns (tuple(uint80 mintPrice, uint48 startTime, uint48 endTime, uint16 maxTotalMintableByWallet, uint16 feeBps, bool restrictFeeRecipients))"
  ];
  try {
    const seaDrop = new ethers.Contract(seaDropAddress, seaDropAbi, provider);
    const drop = await seaDrop.getPublicDrop(contractAddress);
    console.log('✅ SeaDrop getPublicDrop on Robinhood:');
    console.log('   Price:', ethers.formatEther(drop.mintPrice), 'ETH');
    console.log('   Start:', new Date(Number(drop.startTime) * 1000).toLocaleString());
    console.log('   End:', new Date(Number(drop.endTime) * 1000).toLocaleString());
    console.log('   Max Mint:', Number(drop.maxTotalMintableByWallet));
  } catch (e) {
    console.log('SeaDrop getPublicDrop result:', e.message);
  }
}

testRareFriendsDetails().catch(console.error);
