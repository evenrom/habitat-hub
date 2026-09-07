import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBudget } from '../js/store.js';
const item = (id, fields = {}) => ({ id, name: id, room: 'LivingRoom', price: 100, ...fields });
test('paid and remaining stay independent across both priorities and rooms', () => {
 const { global: g, rooms } = calculateBudget([
  item('discount', { is_purchased: true, actual_price: 60 }),
  item('required'),
  item('optional-paid', { is_purchased: 'TRUE', is_nice_to_have: true, actual_price: 150 }),
  item('optional-left', { room: 'Bedroom', is_nice_to_have: 'true', price: 200 })
 ]);
 assert.equal(g.required.paid, 60); assert.equal(g.required.remaining, 100);
 assert.equal(g.optional.paid, 150); assert.equal(g.optional.remaining, 200);
 assert.equal(g.grandTotal, 510); assert.equal(g.remaining, 300);
 assert.equal(rooms.Bedroom.optional.remaining, 200);
 assert.equal(Object.values(rooms).reduce((sum,r) => sum+r.grandTotal,0),g.grandTotal);
});
test('zero actual price is valid; blank actual price falls back with disclosure', () => {
 const g = calculateBudget([item('free',{is_purchased:true,actual_price:0}),item('fallback',{is_purchased:true,actual_price:''})]).global;
 assert.equal(g.spent,100); assert.equal(g.required.estimatedPaid,1); assert.equal(g.remaining,0);
});
test('alternatives are excluded and purchased alternatives are flagged', () => {
 const result = calculateBudget([item('alt',{type:' Alternative ',is_purchased:true})]);
 assert.equal(result.global.grandTotal,0); assert.equal(result.warnings.length,1);
});
test('missing and invalid prices are disclosed; empty rooms and hostile room keys are safe', () => {
 const result = calculateBudget([item('missing',{price:''}),item('invalid',{price:-2}),item('safe',{room:'__proto__'})],['Kitchen']);
 assert.equal(result.global.required.unpriced,2); assert.equal(result.rooms.Kitchen.grandTotal,0);
 assert.equal(result.rooms.__proto__.remaining,100);
 assert.equal(calculateBudget([]).global.grandTotal,0);
});
