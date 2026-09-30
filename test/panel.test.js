import test from 'node:test';
import assert from 'node:assert/strict';
import {panelDesign,panelView,publishPanel} from '../src/panel.js';
import {Store} from '../src/store.js';
const opts=data=>({getString:k=>data[k]??null});
test('painel personalizado mantém consentimento e abre autorização sem página inicial',()=>{
 const d=panelDesign(opts({titulo:'Minha loja',cor:'#123456',banner:'https://example.com/a.png',miniatura:'https://example.com/b.png',rodape:'Loja',texto:'Olá',botao:'Integrar conta',descricao:'Linha 1\\nLinha 2'}));
 const v=panelView(d,{base:'https://example.com'});const e=v.embeds[0].toJSON();assert.equal(e.title,'Minha loja');assert.match(e.description,/Linha 1\nLinha 2/);assert.match(e.description,/servidor substituto/);assert.equal(e.image.url,d.banner);assert.equal(v.components[0].toJSON().components[0].url,'https://example.com/oauth/start');assert.deepEqual(v.allowedMentions.parse,[]);
});
test('personalização valida cor, URLs e permite remover imagens sem perder outros campos',()=>{
 assert.throws(()=>panelDesign(opts({cor:'roxo'})));assert.throws(()=>panelDesign(opts({banner:'http://example.com/a'})));assert.throws(()=>panelDesign(opts({botao:'-'})));
 const d=panelDesign(opts({banner:'-'}),{titulo:'Mantido',banner:'https://example.com/a'});assert.equal(d.titulo,'Mantido');assert.equal(d.banner,'');
});
test('editar painel preserva campos e recusa mensagens de outro autor',async()=>{
 const store=new Store(':memory:','a'.repeat(64));const id='123456789012345678';let edited;
 const message={author:{id:'bot'},components:[{components:[{url:'https://example.com/oauth/start'}]}],edit:async v=>{edited=v;return {id};}};
 store.run('INSERT INTO settings VALUES(?,?)','panel:'+id,JSON.stringify(panelDesign(opts({titulo:'Antes',banner:'https://example.com/a'}))));
 const i={options:{...opts({mensagem:id,titulo:'Depois'}),getChannel:()=>({messages:{fetch:async()=>message}})}};
 await publishPanel(i,{store,client:{user:{id:'bot'}},cfg:{base:'https://example.com'}});assert.equal(edited.embeds[0].toJSON().title,'Depois');assert.equal(edited.embeds[0].toJSON().image.url,'https://example.com/a');
 message.author.id='other';await assert.rejects(()=>publishPanel(i,{store,client:{user:{id:'bot'}},cfg:{base:'https://example.com'}}));store.db.close();
});
