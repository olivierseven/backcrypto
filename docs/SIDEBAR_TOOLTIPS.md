# Tooltips dos menus do sidebar — descrições completas

## PT

### Quadro 0 — Períodos
Períodos (Quadro 0)

Atualmente é possível configurar até 3 períodos distintos.
Esse limite foi definido para manter o modelo claro e interpretável.
Versões futuras poderão expandir essa configuração.

### Quadro 1 — Mortalidade residual
Taxa de Mortalidade Residual Anual (Quadro 1)

Taxa de mortalidade residual anual no início do intervalo. Representa a proporção da população que morre por causas não relacionadas à velhice no primeiro ano do intervalo. Essa taxa não inclui morte por senescência, que é calculada separadamente no modelo específico de velhice.

Taxa de mortalidade residual anual ao final do intervalo. Se maior que a taxa inicial, indica aumento progressivo da mortalidade residual; se menor, indica redução progressiva; se igual, a mortalidade residual permanece constante durante todo o intervalo.

Intervalo (anos)
Duração do intervalo temporal, em anos, durante o qual a taxa de mortalidade residual é modificada. Este valor é derivado automaticamente a partir do início e do fim do intervalo definidos pelo usuário.

fator_mortalidade_anual
Fator multiplicativo anual aplicado à taxa de mortalidade residual dentro do intervalo. É calculado de forma que a taxa evolua progressivamente do valor inicial até o valor final ao longo do número de anos definido.

Interpretação do fator:
fator < 1 → redução gradual da mortalidade residual
fator = 1 → mortalidade residual constante
fator > 1 → aumento gradual da mortalidade residual
Quando a taxa inicial e final são iguais, o fator anual é exatamente 1, simulando um intervalo de estabilidade sem mudanças na mortalidade residual.

Modelo de Evolução da Mortalidade Residual
A evolução da mortalidade residual dentro de cada intervalo segue uma progressão geométrica discreta (exponencial suave), e não linear. Isso permite representar de forma realista mudanças graduais nas condições externas de sobrevivência.

A mortalidade residual agrega todas as causas de morte não relacionadas ao envelhecimento biológico, como:
doenças infecciosas
acidentes
fome
violência
guerras
desastres ambientais
condições socioeconômicas

O comportamento da mortalidade residual é progressivo apenas dentro de cada intervalo definido. Ao longo da simulação total, diferentes intervalos podem apresentar quedas, aumentos ou estabilidade, permitindo simular cenários históricos, ambientais ou sociais distintos (ex.: avanços médicos, crises, colapsos ou eventos extremos).

A mortalidade residual não substitui a mortalidade por velhice. Ambas são avaliadas no mesmo ano, mas representam processos distintos.
No modelo, a probabilidade total de morte de um indivíduo em determinado ano é obtida por composição probabilística, garantindo que um mesmo indivíduo não seja contabilizado mais de uma vez como óbito no mesmo período.
De forma conceitual, o modelo considera que um indivíduo pode morrer: por velhice (senescência), ou por outras causas externas (mortalidade residual).
A combinação dessas probabilidades é feita de modo a evitar dupla contagem de mortes, preservando a coerência estatística da simulação.

### Quadro 2 — Reprodução
Parâmetros de Reprodução

idade_fertil_min: Idade mínima a partir da qual o indivíduo pode se reproduzir. Em humanos, costuma ficar entre 14 e 16 anos.
idade_fertil_max: Idade em que a fertilidade chega a zero. Para humanos, valores comuns ficam entre 45 e 50 anos.
idade_fertil_pico: Idade de maior fertilidade. Em humanos, o pico geralmente ocorre entre 22 e 27 anos.
tx_decaimento_pos_pico: Controla a velocidade de queda da fertilidade após o pico. Valores menores indicam queda lenta; valores maiores indicam queda rápida. Para humanos, recomenda-se algo entre 0,20 e 0,25.
prob_anual_reproducao: Probabilidade máxima de ter ao menos um filho em um ano, no pico fértil. Em humanos modernos, valores realistas variam entre 15% e 30%. Valores mais altos simulam cenários teóricos ou populações sem controle reprodutivo.

Modelo de Fertilidade por Idade
Este simulador utiliza um modelo de fertilidade por faixas etárias, dividido em três etapas:
Fase inicial (antes da idade fértil mínima) — A probabilidade de reprodução é nula.
Fase fértil constante (até o pico) — Entre a idade fértil mínima e a idade de pico, a probabilidade de reprodução permanece constante, representando o período de maior capacidade reprodutiva.
Decaimento exponencial após o pico — Após a idade de pico, a probabilidade de reprodução passa a diminuir de forma exponencial, simulando o declínio da fertilidade com o avanço da idade.
A probabilidade efetiva em cada idade resulta da aplicação do fator etário sobre a probabilidade anual máxima de reprodução definida pelo usuário.
Este modelo é uma simplificação estatística e não separa causas individuais como decisão social, infertilidade, contracepção ou aborto. Esses fatores estão implicitamente incorporados na probabilidade anual de reprodução.

### Quadro 3 — Deslocamento
Deslocamento (quadro 3)

dispersaoDesc: Escala típica do deslocamento anual dos indivíduos, em quilômetros. Representa a distância média percorrida a cada ano. O desvio padrão é calculado automaticamente como média/3, controlando a variabilidade dos movimentos. Quanto maior esse valor, maior tende a ser a mobilidade anual dos indivíduos e maior a distância em que os filhos podem nascer em relação à genitora.

Modelo de deslocamento
O simulador utiliza uma distribuição normal para o deslocamento anual. A cada ano, a distância percorrida por cada indivíduo é sorteada com base na média configurada e em seu desvio padrão (média/3), com direção escolhida aleatoriamente. Ao nascer, os filhos são posicionados próximos à genitora, seguindo o mesmo modelo de dispersão. O movimento ocorre apenas dentro das áreas válidas do mapa.

### Quadro 4 — Fecundidade do parto
Parâmetros de Fecundidade do Parto

fecundidade_media: Número médio de filhos que nascem quando ocorre um parto. Em humanos, o valor típico é próximo de 1, com partos simples sendo a grande maioria e partos múltiplos ocorrendo raramente.
fecundidade_max: Limite máximo de filhos por evento de parto (intervalo [1, 100]). O número efetivo de filhos em cada reprodução é sorteado pela distribuição de Poisson e depois limitado por este valor (teto por parto). Evita que um único parto gere mais filhos do que o definido.
idade_fertil_pico: Idade em que o potencial reprodutivo da fêmea atinge seu máximo. Nessa fase, além da maior probabilidade de ocorrer gestação, o número médio de filhos por parto tende a ser mais alto. Em humanos, esse pico geralmente ocorre entre 22 e 27 anos.
tx_decaimento: Controla a velocidade de redução do número médio de filhos por parto após a idade de pico. Valores menores indicam queda lenta; valores maiores indicam queda rápida. Para humanos, recomenda-se algo entre 0,20 e 0,25.

Modelo de Fecundidade do Parto (Poisson)
Este simulador utiliza um modelo probabilístico de Poisson para determinar o número de filhos em cada parto.
O modelo funciona da seguinte forma:
Quando ocorre um evento reprodutivo, o número de filhos nascidos é sorteado a partir de uma distribuição de Poisson.
O parâmetro central do modelo é o número médio de filhos por parto, definido pelo usuário.
O modelo permite naturalmente partos simples, partos múltiplos e falhas gestacionais (quando o resultado é zero).
A fecundidade do parto pode variar com a idade da fêmea, mantendo-se constante até a idade de pico e sofrendo decaimento exponencial após o pico, simulando a redução biológica da capacidade reprodutiva.
Este modelo é uma simplificação estatística, amplamente utilizado em demografia e ecologia, e não separa explicitamente fatores como genética, saúde materna ou perdas embrionárias. Esses efeitos estão implicitamente incorporados nos parâmetros definidos.

### Quadro 5 — Mortalidade por velhice
Configuração mortalidade por velhice

idade_inicio: Idade a partir da qual a mortalidade por senescência começa a ser aplicada. Este valor é calculado automaticamente como idade_fertil_max + 1, garantindo coerência biológica e evitando configurações biologicamente irreais.
fragilidade: Risco inicial de morte por velhice no primeiro ano após o início da senescência. Valores maiores indicam organismos mais frágeis no início da velhice. Para humanos, valores típicos variam entre 0,003 e 0,008.
taxa_envelhecimento: Controla a velocidade com que o risco de morte aumenta com a idade. Valores maiores produzem um envelhecimento mais rápido e uma expectativa de vida menor. Para humanos, valores realistas ficam entre 0,07 e 0,10.
max_idade: Idade máxima absoluta permitida no modelo. Indivíduos que atingem essa idade morrem automaticamente, funcionando como um limite de segurança numérica. O modelo de Gompertz faz com que poucos indivíduos cheguem próximos a esse valor.

Modelo de Mortalidade por Idade
Este simulador utiliza o modelo de Gompertz para representar a mortalidade natural associada ao envelhecimento:
Antes do início da velhice — Não há mortalidade por senescência; apenas outras causas podem ocorrer.
Início da velhice — A mortalidade começa em um nível baixo, definido pela fragilidade inicial.
Aumento exponencial com a idade — O risco de morte cresce de forma exponencial ano a ano, refletindo o envelhecimento biológico.

Observação
A taxa de mortalidade total do modelo já inclui todas as causas de morte, incluindo doenças, acidentes e envelhecimento.
O modelo de Gompertz não adiciona novas mortes nem altera a mortalidade total configurada. Ele apenas define como essa mortalidade é distribuída ao longo da idade, fazendo com que indivíduos mais velhos tenham maior probabilidade de morrer do que indivíduos jovens.
Em outras palavras, o modelo de velhice redistribui o risco no tempo, sem modificar o número total esperado de mortes.

### Quadro 6 — Fator continental
Fator continental de mortalidade

Fator multiplicador da mortalidade anual do continente.
O valor 1 representa a taxa base do período. Valores entre 0 e 2 ajustam proporcionalmente a mortalidade, intensificando ou reduzindo seus efeitos.
A taxa resultante está sujeita a limites técnicos para preservar estabilidade e realismo demográfico.

---

## EN

### Panel 0 — Periods
Periods (Panel 0)

It is currently possible to configure up to 3 distinct periods.
This limit was defined to keep the model clear and interpretable.
Future versions may expand this configuration.

### Panel 1 — Residual mortality
Residual Annual Mortality Rate (Panel 1)

Residual annual mortality rate at the start of the interval. Represents the proportion of the population that dies from causes unrelated to old age in the first year of the interval. This rate does not include senescent death, which is calculated separately in the old-age model.

Residual annual mortality rate at the end of the interval. If greater than the initial rate, indicates progressive increase; if lower, progressive reduction; if equal, residual mortality remains constant throughout the interval.

Interval (years)
Duration of the temporal interval, in years, during which the residual mortality rate is modified. This value is automatically derived from the start and end defined by the user.

annual_mortality_factor
Annual multiplicative factor applied to residual mortality within the interval. It is calculated so that the rate evolves progressively from initial to final value over the defined number of years.

Factor interpretation:
factor < 1 → gradual reduction of residual mortality
factor = 1 → constant residual mortality
factor > 1 → gradual increase of residual mortality
When initial and final rates are equal, the annual factor is exactly 1, simulating a stability interval with no changes in residual mortality.

Residual Mortality Evolution Model
The evolution of residual mortality within each interval follows a discrete geometric progression (smooth exponential), not linear. This allows realistic representation of gradual changes in external survival conditions.

Residual mortality aggregates all causes of death unrelated to biological aging, such as:
infectious diseases
accidents
famine
violence
wars
environmental disasters
socioeconomic conditions

Residual mortality behavior is progressive only within each defined interval. Over the total simulation, different intervals may show decreases, increases, or stability.

Residual mortality does not replace old-age mortality. Both are evaluated in the same year but represent distinct processes.
In the model, the total probability of death of an individual in a given year is obtained by probabilistic composition.
Conceptually, the model considers that an individual may die: from old age (senescence), or from other external causes (residual mortality).
The combination of these probabilities is done so as to avoid double-counting of deaths.

### Panel 2 — Reproduction
Reproduction Parameters

idade_fertil_min: Minimum age from which the individual can reproduce. In humans, typically 14–16 years.
idade_fertil_max: Age at which fertility reaches zero. For humans, common values are 45–50 years.
idade_fertil_pico: Age of peak fertility. In humans, the peak usually occurs between 22 and 27 years.
tx_decaimento_pos_pico: Controls the rate of fertility decline after the peak. Lower values mean slow decline; higher values mean fast decline. For humans, 0.20–0.25 is recommended.
prob_anual_reproducao: Maximum probability of having at least one child per year at peak fertility. In modern humans, realistic values range from 15% to 30%. Higher values simulate theoretical scenarios or populations without birth control.

Fertility Model by Age
This simulator uses an age-based fertility model, divided into three stages:
Initial phase (before minimum fertile age) — Reproduction probability is zero.
Constant fertile phase (until peak) — Between minimum and peak age, reproduction probability remains constant, representing peak reproductive capacity.
Exponential decay after peak — After peak age, reproduction probability decreases exponentially, simulating fertility decline with age.
The effective probability at each age results from applying the age factor to the user-defined maximum annual reproduction probability.
This model is a statistical simplification and does not separate individual causes such as social choice, infertility, contraception, or abortion. These factors are implicitly incorporated in the annual reproduction probability.

### Panel 3 — Displacement
Displacement (panel 3)

dispersaoDesc: Typical scale of annual individual displacement in kilometers. Represents the average distance traveled per year. Standard deviation is automatically calculated as mean/3, controlling movement variability. The higher this value, the greater the annual mobility and the distance at which offspring can be born relative to the mother.

Displacement model
The simulator uses a normal distribution for annual displacement. Each year, each individual's distance is drawn from the configured mean and standard deviation (mean/3), with direction chosen randomly. At birth, offspring are placed near the mother following the same dispersion model. Movement occurs only within valid map areas.

### Panel 4 — Birth fecundity
Birth Fecundity Parameters

fecundidade_media: Average number of children born per birth event. In humans, the typical value is close to 1, with single births being the vast majority and multiple births occurring rarely.
fecundidade_max: Maximum number of children per birth event ([1, 100]). The effective number of children in each reproduction is drawn from a Poisson distribution and then limited by this value. Prevents a single birth from generating more children than defined.
idade_fertil_pico: Age at which female reproductive potential peaks. At this stage, besides higher pregnancy probability, the average number of children per birth tends to be higher. In humans, this peak usually occurs between 22 and 27 years.
tx_decaimento: Controls the rate of reduction in average children per birth after peak age. Lower values mean slow decline; higher values mean fast decline. For humans, 0.20–0.25 is recommended.

Birth Fecundity Model (Poisson)
This simulator uses a Poisson probabilistic model to determine the number of children in each birth.
The model works as follows:
When a reproductive event occurs, the number of children born is drawn from a Poisson distribution.
The central parameter is the average number of children per birth, defined by the user.
The model naturally allows single births, multiple births, and gestational failures (when the result is zero).
Birth fecundity can vary with female age, remaining constant until peak age and suffering exponential decay after the peak.
This model is a statistical simplification, widely used in demography and ecology, and does not explicitly separate factors such as genetics, maternal health, or embryonic losses. These effects are implicitly incorporated in the defined parameters.

### Panel 5 — Old age mortality
Old age mortality configuration

idade_inicio: Age from which senescent mortality begins to be applied. This value is automatically calculated as idade_fertil_max + 1.
fragilidade: Initial risk of death from old age in the first year after senescence begins. Higher values indicate more fragile organisms at the start of old age. For humans, typical values range from 0.003 to 0.008.
taxa_envelhecimento: Controls the speed at which death risk increases with age. Higher values produce faster aging and shorter life expectancy. For humans, realistic values are between 0.07 and 0.10.
max_idade: Maximum absolute age allowed in the model. Individuals who reach this age die automatically.

Age-Based Mortality Model
This simulator uses the Gompertz model to represent natural mortality associated with aging:
Before onset of old age — No senescent mortality; only other causes may occur.
Onset of old age — Mortality begins at a low level defined by initial fragility.
Exponential increase with age — Death risk grows exponentially year by year.

Note
The model's total mortality rate already includes all causes of death.
The Gompertz model does not add new deaths or alter configured total mortality. It only defines how that mortality is distributed across age.
In other words, the old-age model redistributes risk over time without modifying the total expected number of deaths.

### Panel 6 — Continental factor
Continental mortality factor

Multiplicative factor of continental annual mortality.
The value 1 represents the base rate of the period. Values between 0 and 2 proportionally adjust mortality.
The resulting rate is subject to technical limits to preserve stability and demographic realism.
