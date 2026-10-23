# Painel Eleitoral Brasil 2026

## Executar
Node.js 18+ instalado:

```bash
npm start
```

Abrir http://localhost:3000

## Atenção à integração
O endereço-base e os códigos eleitorais foram obtidos na documentação oficial do TSE. **O caminho detalhado `dados-simplificados/{uf}/{uf}-c0001-e000{turn}.json` é uma hipótese de integração e NÃO foi validado contra o ambiente oficial 2026.** Antes de publicar, conferir o documento de layout e as URLs efetivas para 2026, inclusive a codificação de presidente, agregação nacional/exterior e o mapeamento dos campos `cand`, `vap`, `st`, `s`. O servidor falha explicitamente em vez de inventar dados. 

Atenção: o cálculo nacional agrega somente UFs retornadas; resultados do exterior precisam de integração específica. A comparação é normalizada entre os dois candidatos no primeiro turno; não é projeção. Ajustar indicador de seções ao campo oficial de totalização. Em produção, hospedar em serviço Node persistente (não hospedagem apenas estática), ativar HTTPS, monitoramento e logs.

Fonte: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
