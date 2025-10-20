// start.js
import { networkInterfaces } from 'os';

const nets = networkInterfaces();
const results = {};

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
            if (!results[name]) {
                results[name] = [];
            }
            results[name].push(net.address);
        }
    }
}

console.log('📡 IPs disponibles:');
Object.keys(results).forEach(key => {
    results[key].forEach(ip => {
        console.log(`   http://${ip}:${process.env.PORT || 4000}`);
    });
});