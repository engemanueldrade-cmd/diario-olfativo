# Diário Olfativo

App para gerenciar sua coleção pessoal de perfumes: busca automática de dados
oficiais (casa, perfumista, ano, pirâmide de notas, avaliação) via API da
[Fragella](https://api.fragella.com), mais sua própria nota, notas percebidas
e impressão de cada perfume.

25 perfumes da sua coleção já vêm pré-carregados em `data/seed.json` (dados
pesquisados no Fragrantica) — eles aparecem automaticamente na primeira vez
que o banco de dados é usado.

## Como publicar online (Vercel — gratuito)

### 1. Crie uma conta na Fragella e pegue sua chave de API
1. Acesse https://api.fragella.com e crie uma conta gratuita.
2. Copie sua **API key** (plano free: 20 buscas/mês; planos pagos a partir de
   US$12/mês para 5.000 buscas, se precisar de mais volume).

### 2. Suba o código para o GitHub
```bash
git init
git add .
git commit -m "Diário Olfativo"
```
Crie um repositório vazio no GitHub e siga as instruções dele para
`git remote add origin ...` e `git push`.

### 3. Importe o projeto na Vercel
1. Acesse https://vercel.com, crie uma conta (dá para usar login do GitHub).
2. "Add New" → "Project" → selecione o repositório que você acabou de subir.
3. Antes de clicar em "Deploy", vá em **Environment Variables** e adicione:
   - `FRAGELLA_API_KEY` = a chave que você pegou no passo 1.
4. Clique em **Deploy**.

### 4. Conecte um banco de dados (para os dados persistirem)
1. No projeto já criado na Vercel, vá na aba **Storage**.
2. Clique em **Create Database** → escolha **Redis** (via Upstash, no
   Marketplace da Vercel) → plano gratuito.
3. Conecte esse banco ao seu projeto — a Vercel injeta automaticamente as
   variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (ou, em
   algumas contas, `KV_REST_API_URL`/`KV_REST_API_TOKEN` — o código aceita
   qualquer um dos dois pares).
4. Vá em **Deployments** → nos três pontinhos do último deploy → **Redeploy**,
   para a aplicação pegar as novas variáveis de ambiente.

Pronto — seu link (algo como `https://diario-olfativo.vercel.app`) já estará
no ar, com o banco de dados funcionando e a busca automática pela Fragella
ativa.

## Rodando localmente (opcional)

```bash
npm install
cp .env.local.example .env.local   # preencha FRAGELLA_API_KEY
npm run dev
```
Sem as variáveis do Redis configuradas, o app funciona só leitura, mostrando
os 25 perfumes de `data/seed.json` (não é possível salvar sem um banco
conectado).

## Sobre a integração com a Fragella

O mapeamento dos campos da resposta da Fragella (em `app/api/search/route.js`,
função `normalize`) foi feito a partir da documentação pública deles, sem uma
chave de API real para testar contra o serviço ao vivo. Os nomes dos campos
podem variar ligeiramente na prática — se a busca voltar vazia ou com campos
faltando depois que você tiver sua chave de verdade, me mostre a resposta
bruta (posso adicionar um log temporário) e eu ajusto o mapeamento rapidinho.
