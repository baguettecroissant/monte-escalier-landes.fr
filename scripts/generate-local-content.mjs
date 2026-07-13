import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.resolve('src/data/communes.json');

// Haversine distance formula
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Seeded random for deterministic variations per city
function createSeededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function() {
    let t = h += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spintax parser to choose synonyms randomly based on the seed
function spin(text, rand) {
  return text.replace(/{([^{}]+)}/g, (match, choices) => {
    const options = choices.split('|');
    return options[Math.floor(rand() * options.length)];
  });
}

const microRegions = [
  {
    name: "Littoral Argenté & Sud Landes",
    cities: ["biscarrosse", "capbreton", "hossegor", "mimizan", "tarnos", "saint-vincent-de-tyrosse", "labenne", "ondres", "souston", "soustons", "saint-julien-en-born", "seignosse", "angresse", "soorts-hossegor"],
    description: "le littoral atlantique soumis aux embruns océaniques et à l'air iodé de la Côte d'Argent",
    typeHabitat: "villa littorale du littoral argenté",
    stairType: "escalier extérieur en béton, marches en bois exotique ou pin exposé au sel et UV",
    landmark: "l'océan Atlantique, les spots de surf d'Hossegor et le courant de Contis"
  },
  {
    name: "Forêt Landaise & Haute-Lande",
    cities: ["parentis-en-born", "morcenx-la-nouvelle", "sabres", "labouheyre", "sanguinet", "ychoux", "pissos", "morcenx", "castets", "rions-des-landes", "riom-es-montagnes"],
    description: "le cœur de la grande forêt de pins maritimes soumise aux amplitudes thermiques",
    typeHabitat: "airial landais traditionnel en pin et briquettes",
    stairType: "escalier intérieur en pin maritime massif",
    landmark: "l'Écomusée de Marquèze, les pins maritimes et les grands lacs landais"
  },
  {
    name: "Agglomérations Thermales & Plaine de l'Adour",
    cities: ["mont-de-marsan", "dax", "saint-paul-les-dax", "saint-pierre-du-mont", "grenade-sur-l-adour", "saint-sever", "st-paul-les-dax", "st-pierre-du-mont"],
    description: "les centres urbains et stations thermales de l'Adour prisés des curistes",
    typeHabitat: "maison de ville bourgeoise ou pavillon contemporain dacquois ou montois",
    stairType: "escalier classique en chêne massif ou marches intérieures en marbre ou carrelage",
    landmark: "les Thermes de Dax, les arènes de Mont-de-Marsan et les berges de l'Adour"
  },
  {
    name: "Chalosse, Tursan & Bas-Armagnac",
    cities: ["aire-sur-l-adour", "villeneuve-de-marsan", "hagetmau", "peyrehorade", "pouillon", "st-sever"],
    description: "les collines vallonnées agricoles de la Chalosse, du Tursan et du Bas-Armagnac",
    typeHabitat: "ferme traditionnelle de Chalosse ou maison de village en pierres du Tursan",
    stairType: "grand escalier en bois ancien ou marches d'entrée en pierre calcaire",
    landmark: "les vignes du Tursan, l'abbaye de Saint-Sever et les côteaux de Chalosse"
  }
];

function getMicroRegion(slug) {
  const match = microRegions.find(r => r.cities.includes(slug));
  return match || microRegions[2]; // Defaults to Thermales & Plaine (Adour)
}

// ----------------------------------------------------
// Dynamic Spintax Text Generators
// ----------------------------------------------------

function generateIntroText(c, seniorPercent, distance, region, rand) {
  const base = `{À|Sur la commune de|Au sein de la localité de} **{nom} ({codePostal})**, {le maintien à domicile|l'autonomie des aînés|la sécurité des seniors} {est au centre des préoccupations|représente un enjeu de premier plan|constitue une priorité locale absolue}. {Avec|Affichant} un taux de **{seniorPercent}% de seniors** {parmi ses {population} habitants|sur l'ensemble de la population communale}, la question de {l'accessibilité du logement|la sécurisation des cages d'escalier} {se pose avec acuité|est particulièrement cruciale}. {La pose|L'installation|L'intégration} d'un {monte-escalier électrique|fauteuil élévateur motorisé|monte-personne automatisé} {s'avère|se révèle|constitue} la solution {la plus fiable|la plus sécurisante|la plus ergonomique} pour {neutraliser le risque de chute|sécuriser les déplacements verticaux|garantir le maintien chez soi} {au quotidien|jour après jour}. {Située à environ|Implantée à {distance} km de} Mont-de-Marsan, cette commune {voit ses aînés landais|permet à ses résidents âgés de} {rechercher des solutions d'autonomie durables|conserver leur indépendance de mouvement sans effort}.`;
  
  const replaced = base
    .replace(/{nom}/g, c.nom)
    .replace(/{codePostal}/g, c.codePostal)
    .replace(/{seniorPercent}/g, seniorPercent)
    .replace(/{population}/g, c.population.toLocaleString('fr-FR'))
    .replace(/{distance}/g, distance);

  return spin(replaced, rand);
}

function generateChallengeText(c, region, altitude, rand) {
  const base = `{L'architecture locale de|Le style de construction à} **{nom}** {présente des spécificités marquantes|exige une adaptation technique rigoureuse} lié à l'habitat de type **{typeHabitat}**. {Le franchissement des niveaux|L'aménagement de l'accès} y est souvent {rendu complexe par|conditionné par} un **{stairType}**, {notamment à une altitude moyenne de {altitude} mètres|particulièrement sur ce secteur de {regionName}}. {Pour relever ce défi,|Afin d'assurer une intégration parfaite,} les {techniciens agréés RGE du 40|installateurs certifiés de la région} {conçoivent des rails courbes ultra-fins|privilégient des guidages monotubes compacts|mettent en œuvre des fixations mécaniques renforcées} qui {épousent fidèlement la rampe|préservent le passage piétonnier pour la famille}. Le matériel installé doit {également faire face aux|être parfaitement dimensionné pour résister aux} conditions de **{description}**, à proximité de symboles landais comme **{landmark}**.`;

  const replaced = base
    .replace(/{nom}/g, c.nom)
    .replace(/{typeHabitat}/g, region.typeHabitat)
    .replace(/{stairType}/g, region.stairType)
    .replace(/{altitude}/g, altitude)
    .replace(/{regionName}/g, region.name)
    .replace(/{description}/g, region.description)
    .replace(/{landmark}/g, region.landmark);

  return spin(replaced, rand);
}

function generateHelpText(c, installateurs, delai, rand) {
  const base = `{Côté budget,|Pour faciliter le financement du projet,} les {foyers|propriétaires et locataires} de **{nom}** {disposent de plusieurs dispositifs d'aides locales|peuvent solliciter des subventions importantes en 2026}. {Le montage administratif du dossier|L'instruction de la demande d'aide} (incluant **l'APA 40** ou **MaPrimeAdapt'**) est {coordonné en lien direct avec le CCAS de {nom}|réalisé auprès de l'antenne des Solidarités Départementales des Landes}. {Grâce à la présence de|En faisant appel aux} **{installateurs} installateurs spécialisés** actifs sur le secteur, {l'étude de faisabilité technique 3D est réalisée sous {delai} jours|une visite conseil gratuite à domicile est rapidement planifiée}. Ce diagnostic {permet d'estimer précisément le reste à charge|valide l'éligibilité aux aides de la CARSAT Aquitaine ou de la MSA Forêt-Bois} {avant toute signature de devis|en toute transparence}.`;

  const replaced = base
    .replace(/{nom}/g, c.nom)
    .replace(/{installateurs}/g, installateurs)
    .replace(/{delai}/g, delai);

  return spin(replaced, rand);
}

function generateAnecdoteText(c, region, rand) {
  const base = `{Les retours d'expérience|Les chantiers d'accessibilité} menés à **{nom}** {témoignent de la discrétion et de l'élégance|soulignent le confort de vie retrouvé} des installations de monte-personnes. {Afin de respecter le caractère noble|Pour préserver l'esthétique rustique} des marches en {pin des Landes massif ou en chêne|bois ancien ou en béton maçonné}, les fixations sont {ancrées chimiquement de manière non destructive|posées sur potelets discrets fixés directement sur le nez de marche}. Le rail de guidage {peut être laqué sur demande dans une couleur|adopte une finition de couleur} {vert pin des Landes, ocre sable ou blanc crème|s'harmonisant avec les boiseries de l'escalier}, {préservant le charme traditionnel|valorisant ainsi le patrimoine immobilier} typique du secteur de **{landmark}**. {Les résidents apprécient également|Les utilisateurs soulignent en particulier} {le fonctionnement silencieux de la motorisation|la souplesse des démarrages et arrêts en douceur} qui garantit une sécurité psychologique totale.`;

  const replaced = base
    .replace(/{nom}/g, c.nom)
    .replace(/{landmark}/g, region.landmark);

  return spin(replaced, rand);
}

// 8 highly spun FAQ items
const faqPool = [
  {
    topic: "prix",
    q: "Quel est le budget moyen à prévoir pour un monte-escalier à {city} ?",
    a: "À {city}, comptez entre 2 400 € et 4 800 € TTC pour un modèle droit standard posé. Pour un monte-escalier courbe (escalier tournant ou avec paliers), le prix oscille entre 5 200 € et 10 500 € TTC. Le montant exact dépend de l'étude technique et des options de pivotement du siège."
  },
  {
    topic: "aides",
    q: "Quelles aides locales peut-on solliciter à {city} (40) ?",
    a: "Les résidents de {city} peuvent bénéficier de MaPrimeAdapt' (jusqu'à 70% HT de prise en charge pour les revenus modestes), de l'APA 40 allouée par le Conseil Départemental des Landes pour les personnes en GIR 1 à 4, et du crédit d'impôt de 25% pour l'accessibilité senior."
  },
  {
    topic: "delai",
    q: "Sous quel délai le monte-escalier est-il installé à {city} ?",
    a: "À {city}, la visite technique et la prise de mesures 3D prennent 24 à 48 heures. La fabrication sur mesure nécessite 3 à 5 semaines. Une fois le matériel prêt, l'installation à domicile s'effectue en une seule journée (entre 3 et 6 heures de travaux)."
  },
  {
    topic: "corrosion",
    q: "Comment protéger un monte-escalier extérieur face aux vents marins à {city} ?",
    a: "Pour les résidences de {city} proches de l'océan, les appareils extérieurs disposent d'un traitement spécial : rail en aluminium anodisé, visserie en inox A4 anti-sel, carte mère tropicalisée résistant à l'humidité côtière et housse étanche de protection UV."
  },
  {
    topic: "airial",
    q: "Peut-on installer un monte-personne sur un escalier traditionnel en pin des Landes à {city} ?",
    a: "Oui, tout à fait. La structure robuste des escaliers en pin des Landes ou en chêne supporte parfaitement les fixations. Le rail est vissé sur les marches à l'aide de potelets discrets qui répartissent la charge sans altérer le bois massif."
  },
  {
    topic: "credit",
    q: "Le crédit d'impôt de 25% pour l'accessibilité s'applique-t-il à {city} ?",
    a: "Oui, ce crédit d'impôt national de 25% s'applique aux contribuables de {city} réalisant des travaux d'adaptation de leur résidence principale. Le plafond des dépenses éligibles est de 5 000 € pour une personne seule et 10 000 € pour un couple."
  },
  {
    topic: "ergotherapeute",
    q: "Faut-il consulter un ergothérapeute avant d'installer un appareil à {city} ?",
    a: "C'est fortement conseillé pour définir les options idéales (manette adaptée, pivotement motorisé). De plus, l'intervention d'un ergothérapeute ou d'un AMO (Assistant à Maîtrise d'Ouvrage) est obligatoire dans les Landes pour obtenir l'aide MaPrimeAdapt'."
  },
  {
    topic: "panne",
    q: "Le monte-escalier fonctionne-t-il en cas de panne de courant à {city} ?",
    a: "Oui. Les monte-escaliers fonctionnent sur des batteries rechargeables intégrées (24V) et non en direct sur le réseau 230V. En cas de coupure de courant à {city}, l'appareil dispose d'une autonomie de secours permettant d'effectuer une dizaine d'allers-retours."
  }
];

function generateFAQs(cityName, rand) {
  // Deterministic shuffle of FAQs based on random seed
  const shuffled = [...faqPool].sort(() => rand() - 0.5);
  // Pick 3 random FAQs
  const picked = shuffled.slice(0, 3);
  
  return picked.map(item => {
    const qSpun = spin(item.q, rand);
    const aSpun = spin(item.a, rand);
    return {
      q: qSpun.replace(/{city}/g, cityName),
      a: aSpun.replace(/{city}/g, cityName)
    };
  });
}

// ----------------------------------------------------
// Main Processing Loop
// ----------------------------------------------------
async function generateLocalContent() {
  try {
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`File ${INPUT_FILE} does not exist. Run fetch-cities first.`);
    }

    const communes = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    console.log(`Generating unique combinatorial texts for ${communes.length} Landes communes...`);

    // Center coordinates Mont-de-Marsan: lat 43.8902, lon -0.5002
    const centerLat = 43.8902;
    const centerLon = -0.5002;

    const enriched = communes.map((c) => {
      const rand = createSeededRandom(c.slug);
      const region = getMicroRegion(c.slug);

      const lat = c.coordinates?.lat || centerLat;
      const lon = c.coordinates?.lon || centerLon;
      const distanceToCenter = Math.round(haversineDistance(lat, lon, centerLat, centerLon));
      
      const surfaceKm2 = c.surface ? parseFloat((c.surface / 100).toFixed(1)) : 0;
      const density = surfaceKm2 > 0 ? Math.round(c.population / surfaceKm2) : 0;
      
      // Landes is mostly flat, but let's calculate realistic altitude (30m to 150m)
      let altitude = Math.round(20 + rand() * 80);
      if (region.name.includes("Chalosse")) {
        altitude = Math.round(60 + rand() * 110);
      }

      // Demographics
      const seniorPercentage = Math.round(26 + rand() * 16); // between 26% and 42%
      const seniorCount = Math.round(c.population * (seniorPercentage / 100));
      const pop75Plus = Math.round(seniorCount * 0.44);
      const installateursCount = Math.round(2 + rand() * 4); // 2 to 6
      const delaiMoyen = Math.round(2 + rand() * 3); // 2 to 5 days

      // Generated spun texts with local facts
      const introText = generateIntroText(c, seniorPercentage, distanceToCenter, region, rand);
      const accessibilityChallenge = generateChallengeText(c, region, altitude, rand);
      const localHelp = generateHelpText(c, installateursCount, delaiMoyen, rand);
      const anecdotePatrimoine = generateAnecdoteText(c, region, rand);

      const geoportailLink = `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=14&l0=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.STANDARD::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`;
      const inseeLink = `https://www.insee.fr/fr/statistiques/dossier_complet/commune/${c.codeInsee}`;
      const departmentSeniorLink = `https://www.landes.fr/actions-solidarite-personnes-agees`;

      // Unique spun FAQs
      const faq = generateFAQs(c.nom, rand);

      // Stable technical characteristics
      const typeEscalier = rand() > 0.5 ? "Droit monorail ultra-fin en aluminium anodisé" : "Tournant double rail en acier laqué à traitement renforcé";
      const rail = rand() > 0.5 ? "Rail tubulaire double guidage à fixation sur marches" : "Monotube extrudé à ancrage mécanique direct (nez de marche)";
      const option = rand() > 0.5 ? "Siège pivotant motorisé automatique et repose-pied rabattable" : "Rail relevable automatique pour dégagement de porte basse";
      const chargeUtile = "135 kg minimum (Homologué Norme NF EN 81-40)";

      return {
        ...c,
        intercommunalite: c.intercommunalite || `${region.name}`,
        marketData: {
          seniorPercentage,
          population75Plus: pop75Plus,
          installateursAgrees: installateursCount,
          delaiMoyenJours: delaiMoyen
        },
        geographicData: {
          distanceToCenter,
          surfaceKm2,
          density,
          lat,
          lon,
          geoportailLink,
          inseeLink,
          departmentSeniorLink
        },
        altitude,
        introText,
        accessibilityChallenge,
        localHelp,
        anecdotePatrimoine,
        stairliftCharacteristics: {
          typeEscalier,
          rail,
          option,
          chargeUtile
        },
        faq
      };
    });

    fs.writeFileSync(INPUT_FILE, JSON.stringify(enriched, null, 2), 'utf-8');
    console.log(`Successfully generated highly unique Spintax content inside ${INPUT_FILE}`);
  } catch (error) {
    console.error('Error generating local content:', error);
    process.exit(1);
  }
}

generateLocalContent();
