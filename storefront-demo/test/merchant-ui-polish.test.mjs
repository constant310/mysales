import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {internationalWhatsApp,splitInternationalWhatsApp,COUNTRIES} from '../auth/phone.mjs';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('country codes use canonical international WhatsApp numbers',()=>{
 assert.equal(internationalWhatsApp('0803 123 4567','+234'),'+2348031234567');
 assert.equal(internationalWhatsApp('8031234567','+234'),'+2348031234567');
 assert.equal(internationalWhatsApp('2348031234567','+234'),'+2348031234567');
 assert.equal(internationalWhatsApp('024 123 4567','+233'),'+233241234567');
 assert.equal(internationalWhatsApp('07700 900123','+44'),'+447700900123');
 assert.equal(internationalWhatsApp('202 555 0101','+1'),'+12025550101');
 assert.equal(internationalWhatsApp('0171 1234567','other','+49'),'+491711234567');
 assert.equal(internationalWhatsApp('+233241234567','+234'),'+233241234567');
 assert.ok(COUNTRIES.length>=10);
 assert.throws(()=>internationalWhatsApp('123','+234'),/valid WhatsApp/);
 assert.throws(()=>internationalWhatsApp('803 123 4567','other',''),/calling code/);
 assert.throws(()=>internationalWhatsApp('hi phone','+234'),/digits/);
});

test('existing international numbers prefill the country and local number',()=>{
 assert.deepEqual(splitInternationalWhatsApp('+2348031234567'),{selected:'+234',local:'8031234567',other:''});
 assert.deepEqual(splitInternationalWhatsApp('+447700900123'),{selected:'+44',local:'7700900123',other:''});
 assert.deepEqual(splitInternationalWhatsApp(''),{selected:'+234',local:'',other:''});
 const other=splitInternationalWhatsApp('+49891234567');
 assert.equal(other.selected,'other');
 assert.equal(internationalWhatsApp(other.local,other.selected,other.other),'+49891234567');
});

test('create store supports country selection and sends normalized phone',async()=>{
 const html=await read('create/index.html');
 assert.match(html,/id="whatsapp-country"/);
 assert.match(html,/id="custom-country"/);
 assert.match(html,/fillCountryCodes/);
 assert.match(html,/payload\.whatsapp=internationalWhatsApp/);
});

test('manager header is uncluttered; View my shop is still available',async()=>{
 const html=await read('manage/index.html');
 assert.doesNotMatch(html,/id="header-live-store"/);
 assert.doesNotMatch(html,/class="manager-tag">Manage Store/);
 assert.doesNotMatch(html,/<a class="head-btn" href="\/manage\/"/);
 assert.match(html,/id="public-link"/);
 assert.match(html,/id="exit"/);
});

test('business settings have country selection and preserve E.164 on update',async()=>{
 const html=await read('manage/index.html');
 assert.match(html,/id="business-country"/);
 assert.match(html,/id="business-other-country"/);
 assert.match(html,/splitInternationalWhatsApp\(currentStore\.whatsapp\)/);
 assert.match(html,/data\.whatsapp=internationalWhatsApp/);
 assert.match(html,/!values\.whatsapp\|\|!settingsForm\.checkValidity\(\)/);
});

test('merchant cards use consistent responsive grid, badges and action footer',async()=>{
 const html=await read('manage/index.html');
 assert.match(html,/#product-section \.product-list\{display:grid;grid-template-columns:repeat\(2/);
 assert.match(html,/@media\(max-width:700px\)\{#product-section \.product-list\{grid-template-columns:1fr/);
 assert.match(html,/product-badges/);
 assert.match(html,/badge-stock/);
 assert.match(html,/\.quick-share\{display:flex/);
});

test('single and bulk WhatsApp sharing include description and photo links',async()=>{
 const html=await read('manage/index.html');
 assert.match(html,/function singleProductWhatsappText\(p\)/);
 assert.match(html,/const details=String\(p\.description\|\|''\)\.trim\(\)/);
 assert.match(html,/const message=singleProductWhatsappText\(p\)/);
 assert.match(html,/window\.open\('https:\/\/wa\.me\/\?text='\+encodeURIComponent\(singleProductWhatsappText\(dialogProduct\)\)/);
 assert.match(html,/if\(details\)lines\.push\(details\)/);
 assert.match(html,/Photo: /);
});
