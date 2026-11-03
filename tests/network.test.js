import test from 'node:test';
import assert from 'node:assert/strict';
import { mbps, networkRate, decimalByteRate, networkVolume } from '../src/network-format.js';
test('network units distinguish megabits per second from megabytes per second',()=>{
 assert.equal(mbps(1000000),8); assert.equal(networkRate(1000000),'8 Mb/s'); assert.equal(decimalByteRate(1000000),'1 MB/s'); assert.equal(networkVolume(1000000000),'1 GB');
});
test('missing samples stay unavailable while genuine zero is displayed',()=>{
 assert.equal(mbps(null),null); assert.equal(networkRate(undefined),'—'); assert.equal(networkRate(0),'0 Mb/s'); assert.equal(networkVolume(0),'0 B'); assert.equal(networkRate(Infinity),'—'); assert.equal(decimalByteRate(-1),'—');
});
