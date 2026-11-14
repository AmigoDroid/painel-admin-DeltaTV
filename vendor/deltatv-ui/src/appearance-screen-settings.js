// Defaults match the API's appearance.screens.js. Older saved themes are normalized on load.
export const SCREEN_DEFAULTS = {
  login: {heading:'Entre com sua conta IPTV',subtitle:'Use o usuário e a senha fornecidos pelo seu provedor.',userLabel:'Usuário',passwordLabel:'Senha',submitLabel:'Conectar',footer:'Acesso configurado pelo seu provedor'},
  home: {heading:'Bem-vindo',subtitle:'Seu entretenimento em um só lugar.',liveLabel:'TV ao vivo',moviesLabel:'Filmes',seriesLabel:'Séries',featuredLabel:'Em destaque',showBanner:true,showFeatured:true},
  live: {heading:'TV ao vivo',subtitle:'Escolha um canal para assistir.',emptyLabel:'Nenhum canal disponível'},
  movies: {heading:'Filmes',subtitle:'Escolha algo para assistir.',searchLabel:'Buscar filmes',categoriesLabel:'Categorias',emptyLabel:'Nenhum filme encontrado'},
  series: {heading:'Séries',subtitle:'Encontre sua próxima série.',searchLabel:'Buscar séries',categoriesLabel:'Categorias',emptyLabel:'Nenhuma série encontrada'},
};
export const STUDIO_SCREENS = [
  ['general','Geral'],['login','Login'],['home','Home'],['live','TV ao vivo'],['movies','Filmes'],['series','Séries'],
];
export const STUDIO_FIELDS = {
  login:[['heading','Título',90],['subtitle','Instruções',150],['userLabel','Campo usuário',40],['passwordLabel','Campo senha',40],['submitLabel','Botão de entrada',36],['footer','Rodapé',110]],
  home:[['heading','Título principal',90],['subtitle','Mensagem de boas-vindas',150],['liveLabel','Nome TV ao vivo',40],['moviesLabel','Nome Filmes',40],['seriesLabel','Nome Séries',40],['featuredLabel','Nome da seção de destaques',50]],
  live:[['heading','Título de canais',70],['subtitle','Descrição',150],['emptyLabel','Sem canais',100]],
  movies:[['heading','Título do catálogo',70],['subtitle','Descrição',150],['searchLabel','Barra de busca',60],['categoriesLabel','Título das categorias',50],['emptyLabel','Sem filmes',100]],
  series:[['heading','Título do catálogo',70],['subtitle','Descrição',150],['searchLabel','Barra de busca',60],['categoriesLabel','Título das categorias',50],['emptyLabel','Sem séries',100]],
};
export const TEMPLATE_CHOICES = [['classic','Clássico'],['cinema','Cinema'],['compact','Compacto'],['minimal','Minimalista'],['mosaic','Mosaico'],['library','Biblioteca']];
export function normalizeAppearance(config = {}) {
  const homeLegacy = config?.screens?.home ? {} : {
    heading: config.heroTitle || SCREEN_DEFAULTS.home.heading,
    subtitle: config.tagline || SCREEN_DEFAULTS.home.subtitle,
  };
  return {
    ...config,
    screens: {
      ...(config?.screens || {}),
      ...Object.fromEntries(Object.entries(SCREEN_DEFAULTS).map(([screen, defaults]) => [
        screen, {...defaults, ...(screen === 'home' ? homeLegacy : {}), ...(config?.screens?.[screen] || {})},
      ])),
    },
  };
}
export function updateAppearanceScreen(config, screen, key, value) {
  const valueNow = normalizeAppearance(config);
  return { ...valueNow, screens:{...valueNow.screens,[screen]:{...valueNow.screens[screen],[key]:value}}};
}
