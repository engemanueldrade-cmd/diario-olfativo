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

### 4. Crie o banco de dados no Supabase
1. Acesse https://supabase.com, crie uma conta gratuita e um novo projeto
   (escolha uma senha de banco qualquer — não é usada por este app).
2. No projeto, vá em **SQL Editor** → **New query**, cole o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria
   a tabela `perfumes`.
3. Vá em **Project Settings → API**. Copie:
   - **Project URL** → variável `SUPABASE_URL`
   - **service_role key** (em "Project API keys", não a `anon`/`public`!) →
     variável `SUPABASE_SERVICE_ROLE_KEY`

### 5. Configure as variáveis na Vercel e refaça o deploy
1. No projeto da Vercel, vá em **Settings → Environment Variables** e adicione
   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` com os valores do passo 4.
2. Vá em **Deployments** → nos três pontinhos do último deploy → **Redeploy**,
   para a aplicação pegar as novas variáveis de ambiente.

Pronto — seu link (algo como `https://diario-olfativo.vercel.app`) já estará
no ar, com o banco de dados funcionando e a busca automática pela Fragella
ativa. Na primeira vez que a página carregar, os 25 perfumes de
`data/seed.json` são inseridos automaticamente na tabela.

## Rodando localmente (opcional)

```bash
npm install
cp .env.local.example .env.local   # preencha as três variáveis
npm run dev
```
Sem `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` configuradas, o app funciona só
leitura, mostrando os 25 perfumes de `data/seed.json` (não é possível salvar
sem um banco conectado).

## Segurança do Supabase

A tabela `perfumes` fica com Row Level Security (RLS) ligado e sem nenhuma
política — ou seja, a chave pública (`anon`) não consegue ler nem escrever
nada nela. Só a `service_role key` acessa os dados, e ela só é usada dentro
das rotas de API (`app/api/...`), que rodam no servidor — o navegador nunca
vê essa chave. Por isso é essencial nunca colar a `service_role key` numa
variável com prefixo `NEXT_PUBLIC_`, nem no código do frontend.

## Sobre a integração com a Fragella

O mapeamento dos campos da resposta da Fragella (em `app/api/search/route.js`,
função `normalize`) foi feito a partir da documentação pública deles, sem uma
chave de API real para testar contra o serviço ao vivo. Os nomes dos campos
podem variar ligeiramente na prática — se a busca voltar vazia ou com campos
faltando depois que você tiver sua chave de verdade, me mostre a resposta
bruta (posso adicionar um log temporário) e eu ajusto o mapeamento rapidinho.
