import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addMonthsClamped} from '../src/workspace-dates.js';
test('vencimento somado um mês respeita fevereiro e fim do mês',()=>{
 assert.equal(addMonthsClamped(new Date(2026,0,31)),'2026-02-28');
 assert.equal(addMonthsClamped(new Date(2024,0,31)),'2024-02-29');
 assert.equal(addMonthsClamped(new Date(2026,11,31)),'2027-01-31');
 assert.equal(addMonthsClamped(new Date(2026,3,15)),'2026-05-15');
});
