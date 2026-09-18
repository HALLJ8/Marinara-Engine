# Dificuldade do combate e clima

Registro de implementação de [#6305](https://github.com/Pasta-Devs/Marinara-Engine/issues/6305), após o diretor de combate de #6302. Este documento registra o escopo acordado e os limites da implementação.

## Configuração e dificuldade

Remova o campo **Battlefield Seed** (semente do campo de batalha) e seu resumo, mantendo **Battlefield Size** (tamanho do campo de batalha). Novos encontros recebem sementes aleatórias internas. Ignore as preferências obsoletas de semente da campanha ao iniciar batalhas futuras; preserve sementes aceitas, grades e comportamento de reinício. Altere a descrição de Classic para "Cinematic menu battles."

Normalize a dificuldade por um único helper compartilhado, incluindo configurações antigas com iniciais maiúsculas. Mantenha os multiplicadores de dano inimigo Casual 0,6, Normal 1, Hard 1,3 e Brutal 1,6. Classic deve ajustar apenas o dano inimigo, como Tactical. Audite encontros e saques para o mesmo erro de capitalização. Fixe a dificuldade na criação do encontro, sem alterá-la quando as configurações mudarem durante o combate.

Esses multiplicadores pertencem somente a Traditional (as mecânicas legadas atuais do Engine). Ao implementar 5e, V20 ou outro conjunto de regras, reavalie a dificuldade pela política desse sistema. Não herde os multiplicadores de Traditional por padrão. O ajuste das decisões da IA é separado do escalonamento de dano.

## Clima

Use o clima existente da campanha e a exposição fundamentada do encontro. Salve o clima aceito com o encontro; a ausência do campo em um combate antigo salvo significa mecânicas neutras. Exposição desconhecida é neutra. Ambientes fechados são abrigados. Os aliases atuais de clima devem ser normalizados para os tipos existentes, e definir um tipo deve gerar vento e visibilidade compatíveis.

As regras iniciais valem igualmente para os dois lados: chuva reduz moderadamente o dano de fogo e aumenta o de raio; vento forte penaliza ataques explicitamente marcados como projéteis; baixa visibilidade penaliza ataques explicitamente dependentes de visão; neve aumenta o custo de caminhada em Tactical. Voo e teletransporte mantêm suas regras de movimento. Nenhuma característica de projétil/visão é deduzida do nome de capacidades sem marcação. Tempo limpo/nublado normalmente é neutro. Helpers compartilhados devem orientar previsões, resolução e estimativas da IA sem consumir futuros lançamentos de combate.

Mostre condições e efeitos aceitos nas duas interfaces de combate. Configurações cosméticas do clima não podem desativar as mecânicas. O clima permanece fixo durante um encontro; capacidades de mudar o clima, transições periódicas, raios aleatórios e desgaste por calor ficam para depois. Summoning e futuros conjuntos de regras podem reutilizar o contrato compartilhado de clima sem acrescentar um modo de interface inacabado.

## Decisões inimigas

Preserve papel, adjetivo, proficiência, legalidade e controle de recursos. A dificuldade altera uma variação decisória limitada e com semente: Casual permite mais erros plausíveis, Normal fica próximo da base atual, Hard é mais consistente e Brutal minimiza erros mantendo diferenças de proficiência. Os companheiros usam uma base fixa Normal em toda dificuldade; continuam reagindo ao clima e perigo reais. As restrições de Mindless permanecem intactas.

Use pontuações que considerem o clima para ataques, apoio, posicionamento e reações. Counterspell e guard competem com passar conforme ameaça, custo e personalidade. Nenhuma dificuldade concede comandos ocultos, lançamentos futuros, recursos gratuitos ou ações adicionais. O prompt do GM (mestre do jogo) recebe a dificuldade/o clima aceitos e orientações sobre pressão e escolha de oportunidades; o Engine continua impondo escolhas legais e orçamentos oferecidos. Uma falha do provedor mantém a alternativa local.

## Validação e entrega

Implemente configuração/correção, clima e integração da IA nessa ordem. Acrescente provas executáveis de regressão para capitalização da dificuldade; dano apenas inimigo; exposição climática, aliases, previsões e movimento; salvar/restaurar; escolhas inimigas determinísticas e ajuste dos companheiros; custos de reação e limites do prompt do chefe. Atualize as fixtures existentes de configuração/terreno para a preferência obsoleta de semente. Exercite desktop/celular e ambos os temas, incluindo animações climáticas desativadas. Execute verificações básicas, regressões pertinentes de prompts e navegador e CodeRabbit local antes de marcar o rascunho como pronto.

Os valores iniciais são decisões de design do jogo, não equilíbrio comprovado. Fixtures automatizadas estabelecem mecânicas e invariantes; qualidade dos chefes com provedor real e equilíbrio de campanhas longas precisam de testes de jogo. Issues adiadas permanecem sem responsável até o trabalho realmente começar.

## Detalhes da implementação

As condições compartilhadas ficam em `packages/shared/src/features/combat-conditions.ts`. A dificuldade é normalizada na importação/criação da configuração e nos consumidores de encontros, saques, Classic e Tactical. A variação das decisões inimigas é multiplicada por 2,5 / 1 / 0,4 / 0,15 para Casual / Normal / Hard / Brutal; proficiência e personalidade salvas continuam valendo. As estimativas Classic usam a mesma probabilidade de acerto de d20 oposto da resolução, enquanto Tactical usa a previsão compartilhada de ataque. A perseguição Tactical classifica as rotas pelos custos de terreno e clima para os perfis comuns. Unidades Mindless escolhem a rota legal com menos passos espaciais; ambas as políticas pagam os custos reais de terreno e clima durante o movimento. As reações consideram ameaça esperada e escassez de recursos, com a mesma política de variação apenas para inimigos.

Chuva, chuva intensa e tempestades com exposição multiplicam o dano de fogo por 0,85 e o de raio por 1,15. Projéteis explícitos perdem 10 pontos de precisão com vento forte e 15 com vendavais. Ataques explicitamente dependentes de visão perdem 5 pontos com visibilidade reduzida e 15 com visibilidade ruim. As penalidades combinadas têm limite de 25 pontos. Classic converte esses valores em modificadores de lançamentos de ataque opostos (um ponto para cada cinco pontos de precisão), e sua exibição de condições nomeia essas penalidades. Neve/nevascas com exposição em Tactical acrescentam um ponto de caminhada por casa percorrida; voo e teletransporte não mudam. Itens de dano elemental também recebem os modificadores de chuva; cura e duração de estados não.

A geração de encontros produz os booleanos `projectile` / `requiresSight` de ataques básicos e capacidades e `battlefield.terrainBrief.exposure`. Características de ataque ausentes são neutras. A exposição explícita tem precedência; ambientes fechados reconhecidos são abrigados, externos reconhecidos são expostos, e ambíguos são desconhecidos. O clima da campanha vem do sistema de clima persistido, com alternativa no valor climático de cena confirmado se ausente. Tags de mensagem de início de combate suprimem a progressão climática em segundo plano antes de o modo renderizado acompanhar. Condições aceitas são salvas no diretor e no estado Tactical; importações contraditórias ou malformadas são recusadas. Salvamentos existentes sem clima permanecem neutros. Reinícios Tactical legados passam as condições aceitas (incluindo ausência neutra), em vez de amostrar o clima alterado da campanha.

A configuração ainda valida campos obsoletos nas importações por compatibilidade e segurança, mas os remove das exportações normalizadas. O Engine mantém sementes explícitas de encontro para restauração/reinício e reprodução de regressões. Isso não remove as sementes de mundo de Experience, que têm outra finalidade.

## Registro de verificação

A base `pnpm check` (incluindo localização, tipos, lint e builds de produção) e `pnpm version:check` passaram localmente. A suíte Node cobriu 295 arquivos de regressão; cinco foram reexecutados com sucesso depois de um build concorrente remover brevemente arquivos gerados. As regressões de combate foram reexecutadas após correções de revisão, incluindo tags recebidas de combate, progressão climática fora de combate, perseguição ponderada, consistência da dificuldade, recursos de reação e contexto do chefe.

Chromium desktop em tema claro e Chromium móvel em tema escuro exercitaram configuração/importações, os dois modos de combate, clima com animações desativadas, reações, recargas, alternativa de terreno e isolamento do mapa restaurado. WebKit móvel local não iniciou porque o host não tem libicu74, libjpeg-turbo8, libmanette-0.2-0 e gstreamer1.0-libav; esse navegador continua sendo um item de verificação de CI/manual. A PR registra os resultados finais da revisão e as verificações repetidas da fixture de mapas aleatórios.
