const { ethers } = require('ethers');

async function inspectMinterTx() {
  const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com', {
    chainId: 4663,
    name: 'Robinhood'
  });

  const nftContract = '0x116eaa62241751e0c98da43d458600c6c17cd361';
  console.log(`Checking transfer/mint events on: ${nftContract}...`);

  // Transfer event: event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const zeroFromTopic = ethers.zeroPadValue("0x0000000000000000000000000000000000000000", 32);

  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);

  const logs = await provider.getLogs({
    address: nftContract,
    topics: [transferTopic, zeroFromTopic],
    fromBlock: latestBlock - 5000,
    toBlock: latestBlock
  });

  console.log(`Found ${logs.length} recent mint events!`);
  if (logs.length > 0) {
    const sampleLog = logs[logs.length - 1];
    console.log(`Sample mint TxHash: ${sampleLog.transactionHash}`);

    const tx = await provider.getTransaction(sampleLog.transactionHash);
    console.log(`Transaction Target (to): ${tx.to}`);
    console.log(`Transaction Value: ${ethers.formatEther(tx.value)} ETH`);
    console.log(`Transaction Calldata (input): ${tx.data.slice(0, 74)}...`);
    console.log(`4-byte selector: ${tx.data.slice(0, 10)}`);

    // Let's decode selector
    // 0x161ac21f is mintPublic(address,address,address,uint256)
    // 0xa0712d68 is mint(uint256)
    // 0x2db11544 is publicMint(uint256)
    console.log(`Is SeaDrop mintPublic (0x161ac21f)? ${tx.data.startsWith('0x161ac21f')}`);
    console.log(`Is standard mint (0xa0712d68)? ${tx.data.startsWith('0xa0712d68')}`);
    console.log(`Is publicMint (0x2db11544)? ${tx.data.startsWith('0x2db11544')}`);
  }
}

inspectMinterTx().catch(console.error);
