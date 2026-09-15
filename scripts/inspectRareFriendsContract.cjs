const { ethers } = require('ethers');

async function inspectContract() {
  console.log('=== Inspecting Contract 0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34 on Robinhood Chain ===');
  const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com', {
    chainId: 4663,
    name: 'Robinhood'
  });

  const contractAddress = '0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34';

  // 1. Check if contract is deployed
  const code = await provider.getCode(contractAddress);
  console.log(`Contract Code Size: ${code.length} bytes (Deployed: ${code !== '0x'})`);

  // 2. Test standard ERC721 metadata queries
  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function maxSupply() view returns (uint256)"
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);
  try {
    const [name, symbol, total] = await Promise.all([
      contract.name().catch(() => 'N/A'),
      contract.symbol().catch(() => 'N/A'),
      contract.totalSupply().catch(() => 'N/A')
    ]);
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Total Supply Minted So Far: ${total}`);
  } catch (err) {
    console.error('Metadata query error:', err.message);
  }

  // 3. Check SeaDrop Contract on Robinhood Chain (0x00005EA00Ac477B1030CE7850649663527901b0c)
  const seaDropAddress = '0x00005EA00Ac477B1030CE7850649663527901b0c';
  const seaDropCode = await provider.getCode(seaDropAddress);
  console.log(`\nSeaDrop v1.0 (0x00005EA...): Deployed on Robinhood Chain? ${seaDropCode !== '0x'} (${seaDropCode.length} bytes)`);

  if (seaDropCode !== '0x') {
    const seaDropAbi = [
      "function getPublicDrop(address nftContract) view returns (tuple(uint80 mintPrice, uint48 startTime, uint48 endTime, uint16 maxTotalMintableByWallet, uint16 feeBps, bool restrictFeeRecipients))"
    ];
    const seaDropContract = new ethers.Contract(seaDropAddress, seaDropAbi, provider);
    try {
      const publicDrop = await seaDropContract.getPublicDrop(contractAddress);
      console.log('✅ SeaDrop getPublicDrop on-chain data:');
      console.log('   Mint Price:', ethers.formatEther(publicDrop.mintPrice), 'ETH');
      console.log('   Start Time:', new Date(Number(publicDrop.startTime) * 1000).toLocaleString());
      console.log('   End Time:', new Date(Number(publicDrop.endTime) * 1000).toLocaleString());
      console.log('   Max Total Mintable By Wallet:', Number(publicDrop.maxTotalMintableByWallet));
    } catch (e) {
      console.log('SeaDrop getPublicDrop check:', e.message);
    }
  }
}

inspectContract().catch(console.error);
