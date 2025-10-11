// Quick CLI test for WebSocket progress updates
// Run: node test-websocket-cli.js

const io = require('socket.io-client');

console.log('🔌 Connecting to WebSocket at http://localhost:3000...\n');

const socket = io('http://localhost:3000', {
    transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server!\n');
    console.log('📊 Listening for progress updates...\n');
    console.log('-------------------------------------------');
});

socket.on('disconnect', () => {
    console.log('\n❌ Disconnected from WebSocket server');
    process.exit(0);
});

socket.on('progress', data => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 📈 Progress Update:`);
    console.log(`  Running: ${data.running}`);
    console.log(`  X Total: ${data.xTotal}`);
    console.log(`  Y Minutes: ${data.yMinute}`);
    console.log(`  Enqueued: ${data.enqueued}`);
    console.log(`  Processed: ${data.processed}`);
    console.log(
        `  Progress: ${((data.processed / data.enqueued) * 100).toFixed(1)}%`
    );
    console.log('-------------------------------------------');
});

socket.on('connect_error', error => {
    console.error(`❌ Connection error: ${error.message}`);
    process.exit(1);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Closing connection...');
    socket.disconnect();
    process.exit(0);
});

console.log('💡 Press Ctrl+C to exit\n');
