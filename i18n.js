// AshenCraft website - EN/PT translations.
// A tiny dictionary-based translator: every translatable element carries a
// data-i18n key (HTML stays the English source of truth); applying a language
// rewrites textContent, placeholders and document titles. The choice persists
// in localStorage under "ashen_site_lang" and defaults to the browser
// language (pt* -> PT, everything else EN).
(function () {
  'use strict';

  var STORAGE_KEY = 'ashen_site_lang';

  var DICT = {
    en: {
      'nav.home': 'Home',
      'nav.community': 'Community',
      'nav.discord': 'Discord',
      'nav.bedrock': 'Bedrock',
      'nav.map': 'Map',
      'nav.account': 'Account',
      'nav.login': 'Sign in',
      'nav.logout': 'Sign out',
      'nav.account_page': 'Account page',

      'home.tagline': 'A fantasy MMORPG built on Minecraft',
      'home.sub': 'Pick a weapon, master its skills, and fight across a living world. Everything runs through the AshenCraft launcher: sign in, install, and play.',
      'home.play': 'Get the launcher',
      'home.discord': 'Join the community on Discord',
      'home.players_unknown': 'Players online: unknown',
      'home.players_one': '1 player online',
      'home.players_many': '{count} players online',

      'footer': 'AshenCraft is a fan-made Minecraft experience. Not affiliated with Mojang.',

      'discord.title': 'Community Discord',
      'discord.body': 'The Discord server of AshenCraft: chat with other players, patch notes and changelogs the moment they ship, event announcements, world and build showcases, and a support channel where staff and players answer questions about the launcher, characters and gameplay.',
      'discord.cta': 'Continue to Discord',

      'bedrock.title': 'Bedrock Edition',
      'bedrock.p1': 'AshenCraft isn\'t available on Minecraft: Bedrock Edition. However, if you play Minecraft Bedrock on a computer, you likely already own Minecraft: Java Edition as well! The two editions often come bundled together, so check your library or the Minecraft launcher before buying anything.',
      'bedrock.p2': 'Once you have Java Edition installed, open the AshenCraft launcher: it installs the modpack, signs you in and gets you straight into the world of Ashen.',
      'bedrock.cta': 'Get the launcher',

      'map.live': 'Live world map',
      'map.fullscreen': 'Fullscreen',
      'map.open': 'Open in new tab',

      'account.signin_title': 'Sign in',
      'account.register_title': 'Create your Ashen account',
      'account.username': 'Username',
      'account.password': 'Password',
      'account.password_confirm': 'Confirm password',
      'account.username_hint': '3-32 characters, letters, numbers and underscore.',
      'account.password_hint': 'At least 8 characters.',
      'account.signin_cta': 'Sign in',
      'account.register_cta': 'Create account',
      'account.working': 'Working...',
      'account.switch_to_register': 'No account yet? Create one',
      'account.switch_to_signin': 'Already have an account? Sign in',
      'account.signed_in_as': 'Signed in as',
      'account.signout': 'Sign out',
      'account.member_since': 'Member since {date}',
      'account.need_help': 'Your Ashen account works in the launcher too: sign in there with the same username and password.',
      'account.err_required': 'Please enter both username and password.',
      'account.err_mismatch': 'Passwords do not match.',
      'account.err_connection': 'Connection failed. Please try again later.',
      'account.err_400': 'Check the highlighted requirements (username 3-32 characters, password at least 8).',
      'account.err_401': 'Invalid username or password.',
      'account.err_409': 'That username is already taken.',
      'account.err_429': 'Too many attempts. Please wait a moment and try again.',
      'account.err_503': 'The server is in maintenance mode. Registration and sign-in are paused; please try again later.',
      'account.title_signin': 'Sign in - AshenCraft',
      'account.title_register': 'Create account - AshenCraft',

      'portal.identity_title': 'Minecraft identity',
      'portal.identity_none': 'No Minecraft identity is linked to this account yet. Open the launcher and sign in to link one.',
      'portal.identity_linked': 'Linked as {name}',
      'portal.identity_linked_at': 'Linked {date}',
      'portal.characters_title': 'Characters',
      'portal.characters_empty': 'No characters yet. Create your first hero in the AshenCraft launcher.',
      'portal.characters_error': 'Characters are unavailable right now.',
      'portal.level': 'Level {level}',
      'portal.active': 'Active',
      'portal.last_played': 'Last played {date}',
      'portal.never_played': 'Never played',
      'portal.region': 'Region: {region}',
      'portal.weapons': '{primary} + {offhand}',
      'portal.weapon_only': '{primary}',
      'weapon.greatsword': 'Greatsword',
      'weapon.staff': 'Staff',
      'weapon.bow': 'Bow',
      'weapon.dagger': 'Dagger',
      'weapon.wand': 'Wand',
      'weapon.shield': 'Shield',
      'weapon.fists': 'None',
    },
    pt: {
      'nav.home': 'Início',
      'nav.community': 'Comunidade',
      'nav.discord': 'Discord',
      'nav.bedrock': 'Bedrock',
      'nav.map': 'Mapa',
      'nav.account': 'Conta',
      'nav.login': 'Entrar',
      'nav.logout': 'Sair',
      'nav.account_page': 'Página da conta',

      'home.tagline': 'Um MMORPG de fantasia construído sobre Minecraft',
      'home.sub': 'Escolhe uma arma, domina as suas skills e luta num mundo vivo. Tudo corre através do launcher do AshenCraft: entra, instala e joga.',
      'home.play': 'Obter o launcher',
      'home.discord': 'Junta-te à comunidade no Discord',
      'home.players_unknown': 'Jogadores online: desconhecido',
      'home.players_one': '1 jogador online',
      'home.players_many': '{count} jogadores online',

      'footer': 'AshenCraft é uma experiência Minecraft feita por fãs. Sem afiliação com a Mojang.',

      'discord.title': 'Discord da comunidade',
      'discord.body': 'O servidor de Discord do AshenCraft: conversa com outros jogadores, notas de atualização no momento em que saem, anúncios de eventos, exibições do mundo e builds, e um canal de apoio onde a equipa e os jogadores respondem a dúvidas sobre o launcher, personagens e gameplay.',
      'discord.cta': 'Continuar para o Discord',

      'bedrock.title': 'Edição Bedrock',
      'bedrock.p1': 'O AshenCraft não está disponível para Minecraft: Bedrock Edition. No entanto, se jogas Minecraft Bedrock no computador, provavelmente já tens também Minecraft: Java Edition! As duas edições costumam vir juntas, por isso verifica a tua biblioteca ou o launcher do Minecraft antes de comprar qualquer coisa.',
      'bedrock.p2': 'Depois de teres a Java Edition instalada, abre o launcher do AshenCraft: ele instala o modpack, inicia a tua sessão e leva-te direto ao mundo de Ashen.',
      'bedrock.cta': 'Obter o launcher',

      'map.live': 'Mapa do mundo em direto',
      'map.fullscreen': 'Ecrã inteiro',
      'map.open': 'Abrir num novo separador',

      'account.signin_title': 'Entrar',
      'account.register_title': 'Cria a tua conta Ashen',
      'account.username': 'Utilizador',
      'account.password': 'Palavra-passe',
      'account.password_confirm': 'Confirmar palavra-passe',
      'account.username_hint': '3-32 caracteres, letras, números e underscore.',
      'account.password_hint': 'Pelo menos 8 caracteres.',
      'account.signin_cta': 'Entrar',
      'account.register_cta': 'Criar conta',
      'account.working': 'A processar...',
      'account.switch_to_register': 'Ainda não tens conta? Cria uma',
      'account.switch_to_signin': 'Já tens conta? Entra',
      'account.signed_in_as': 'Sessão iniciada como',
      'account.signout': 'Sair',
      'account.member_since': 'Membro desde {date}',
      'account.need_help': 'A tua conta Ashen também funciona no launcher: entra lá com o mesmo utilizador e palavra-passe.',
      'account.err_required': 'Introduz utilizador e palavra-passe.',
      'account.err_mismatch': 'As palavras-passe não coincidem.',
      'account.err_connection': 'A ligação falhou. Tenta novamente mais tarde.',
      'account.err_400': 'Verifica os requisitos indicados (utilizador 3-32 caracteres, palavra-passe pelo menos 8).',
      'account.err_401': 'Utilizador ou palavra-passe inválidos.',
      'account.err_409': 'Esse utilizador já existe.',
      'account.err_429': 'Demasiadas tentativas. Espera um momento e tenta de novo.',
      'account.err_503': 'O servidor está em modo de manutenção. Registo e início de sessão em pausa; tenta novamente mais tarde.',
      'account.title_signin': 'Entrar - AshenCraft',
      'account.title_register': 'Criar conta - AshenCraft',

      'portal.identity_title': 'Identidade Minecraft',
      'portal.identity_none': 'Ainda não há nenhuma identidade Minecraft ligada a esta conta. Abre o launcher e inicia sessão para ligares uma.',
      'portal.identity_linked': 'Ligada como {name}',
      'portal.identity_linked_at': 'Ligada em {date}',
      'portal.characters_title': 'Personagens',
      'portal.characters_empty': 'Ainda sem personagens. Cria o teu primeiro herói no launcher do AshenCraft.',
      'portal.characters_error': 'As personagens estão indisponíveis neste momento.',
      'portal.level': 'Nível {level}',
      'portal.active': 'Ativa',
      'portal.last_played': 'Jogou pela última vez em {date}',
      'portal.never_played': 'Nunca jogou',
      'portal.region': 'Região: {region}',
      'portal.weapons': '{primary} + {offhand}',
      'portal.weapon_only': '{primary}',
      'weapon.greatsword': 'Montante',
      'weapon.staff': 'Cajado',
      'weapon.bow': 'Arco',
      'weapon.dagger': 'Adaga',
      'weapon.wand': 'Varinha',
      'weapon.shield': 'Escudo',
      'weapon.fists': 'Nenhuma',
    },
  };

  var current = 'en';

  function format(template, params) {
    return template.replace(/\{(\w+)\}/g, function (m, key) {
      return params && key in params ? String(params[key]) : m;
    });
  }

  function t(key, params) {
    var lang = DICT[current] || DICT.en;
    var value = lang[key];
    if (value === undefined) value = DICT.en[key];
    if (value === undefined) return key;
    return format(value, params);
  }

  function apply(lang) {
    current = DICT[lang] ? lang : 'en';
    try { localStorage.setItem(STORAGE_KEY, current); } catch (e) { /* private mode */ }
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var text = t(key);
      if (el.tagName === 'INPUT' && el.type === 'submit') {
        el.value = text;
      } else {
        el.textContent = text;
      }
    }
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < placeholders.length; j++) {
      placeholders[j].setAttribute('placeholder', t(placeholders[j].getAttribute('data-i18n-placeholder')));
    }
    var titles = document.querySelectorAll('[data-i18n-title]');
    for (var k = 0; k < titles.length; k++) {
      titles[k].setAttribute('title', t(titles[k].getAttribute('data-i18n-title')));
    }
    if (document.documentElement) document.documentElement.lang = current;
    var pageTitle = document.body && document.body.getAttribute('data-i18n-page-title');
    if (pageTitle) document.title = t(pageTitle);
    if (typeof CustomEvent === 'function') {
      document.dispatchEvent(new CustomEvent('ashen:lang', { detail: { lang: current } }));
    }
  }

  function currentLang() { return current; }

  function initial() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'pt' || saved === 'en') return saved;
    } catch (e) { /* private mode */ }
    return (navigator.language || '').toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en';
  }

  window.AshenI18n = {
    t: t,
    apply: apply,
    current: currentLang,
    initial: initial,
    format: format,
    STORAGE_KEY: STORAGE_KEY,
  };
})();
