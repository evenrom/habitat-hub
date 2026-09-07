import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterItems, calculateBudget } from '../js/store.js';
const items = [
 {id:'a',name:'Sofa',room:'LivingRoom',store:'IKEA',price:100,is_purchased:false},
 {id:'b',name:'Lamp',room:'LivingRoom',store:'IKEA',price:50,is_purchased:'TRUE',is_nice_to_have:true},
 {id:'c',name:'Bed',room:'Bedroom',store:'Other',price:200,is_purchased:true},
 {id:'d',name:'Alternative',room:'LivingRoom',store:'IKEA',price:80,type:'Alternative'},
 {id:'e',name:'Rug',room:'Bedroom',store:'IKEA',price:30,is_nice_to_have:'true'}
];
test('filters compose across room, store, purchase status and priority',()=>{
 assert.deepEqual(filterItems(items,{currentRoom:'LivingRoom',currentStore:'IKEA',purchaseFilter:'to-buy',priorityFilter:'required'}).map(i=>i.id),['a']);
 assert.deepEqual(filterItems(items,{purchaseFilter:'purchased',priorityFilter:'optional'}).map(i=>i.id),['b']);
 assert.deepEqual(filterItems(items,{purchaseFilter:'to-buy',currentStore:'IKEA'}).map(i=>i.id),['a','e']);
 assert.equal(filterItems(items,{currentRoom:'All',currentStore:'All',purchaseFilter:'all',priorityFilter:'all'}).length,4);
 assert.equal(filterItems(items,{currentRoom:'Bedroom',priorityFilter:'optional',purchaseFilter:'purchased'}).length,0);
});
test('room summaries count only selected furniture and retain required remaining',()=>{
 const {rooms}=calculateBudget(items,['EmptyRoom']);
 assert.equal(rooms.LivingRoom.required.remaining,100);
 assert.equal(rooms.LivingRoom.required.count+rooms.LivingRoom.optional.count,2);
 assert.equal(rooms.LivingRoom.optional.purchasedCount,1);
 assert.equal(rooms.EmptyRoom.required.count,0);
});
