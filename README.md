# Calendário Olímpico
## Feito para juntar todas as olimpíadas nacionais, suas datas, matérias, níveis e referências de estudo em um único só local, assim facilitando a organização da rotina de estudos.
### Feito apenas com HTML, CSS e Javascript, com ajuda de agentes LLM direto na IDE (Google Antigravity). Para facilitar a modificação das olimpíadas e outras informações sem ter que editar diretamente o HTML, o site usa uma base de dados em um arquivo json, que é estruturado da seguinte maneira:
```
[
  {
    "id": "exemplo26",
    "sigla": "exem",
    "nome": "Exemplo Edicao 2026",
    "nivel_escolar": [
      "Ensino Fundamental I"
      "Ensino Fundamental II",
      "Ensino Médio"
    ],
    "materias": [
      "Matemática"
      "Outros"
    ],
    "modalidade": "Presencial",
    "eventos": [
      {
        "tipo": "Inscrição",
        "data": "2026-01-02", //Ano\Mes\Dia
        "descricao": "Prazo final de inscrição pela escola"
      },
      {
        "tipo": "Prova",
        "data": "2026-02-02",//Ano\Mes\Dia
        "descricao": "1ª Fase — Prova na escola"
      },
      {
        "tipo": "Prova",
        "data": "2026-01-03",  //Ano\Mes\Dia
        "descricao": "2ª Fase — Prova regional"
      }
    ],
    "materiais_estudo": [
      {
        "titulo": "Texto Exemplar",
        "url": "https://www.exemplo2026.com.br"
      },
      {
        "titulo": "Portal do Exemplo26",
        "url": "https://portalexemplo26.com.br"
      }
    ]
  },
```
## Nessa estrutura é fácil e rápido editar informações sem alterar o código do site e sem precisar outro serviço como supabase para isso. 
## O código é Open-Source e utiliza a licença GNU GPL V3, favor leia-a antes de fazer algo com esse código. Qualquer um pode fazer um Pull Request para melhorias no site, serei grato por qualquer ajuda com esse projeto.
