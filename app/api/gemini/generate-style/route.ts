import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { generateTextWithFallback } from "@/lib/ai"

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 GENERADOR MAESTRO DE ESTILOS PARA SUNO AI
// ═══════════════════════════════════════════════════════════════════════════════
// Este sistema genera estilos musicales optimizados para Suno AI que funcionan
// universalmente bien, incluso con información mínima del usuario.
// ═══════════════════════════════════════════════════════════════════════════════

// Mapeo inteligente de ocasiones a características musicales
const OCCASION_MUSIC_MAP: Record<string, { energy: string; mood: string; tempo: string; suggested_elements: string[] }> = {
  // 💝 Para dedicar / General
  "para dedicar": { energy: "media", mood: "emotivo y personal", tempo: "medio", suggested_elements: ["heartfelt", "intimate", "emotional", "personal"] },
  "dedicar": { energy: "media", mood: "emotivo y personal", tempo: "medio", suggested_elements: ["heartfelt", "intimate", "emotional", "personal"] },
  "ocasión especial": { energy: "media", mood: "emotivo y memorable", tempo: "medio", suggested_elements: ["special", "emotional", "memorable", "heartfelt"] },
  
  // 🎉 Celebraciones
  "cumpleaños": { energy: "alta", mood: "alegre y festivo", tempo: "medio-alto", suggested_elements: ["upbeat", "celebratory", "festive", "joyful"] },
  "birthday": { energy: "alta", mood: "alegre y festivo", tempo: "medio-alto", suggested_elements: ["upbeat", "celebratory", "festive", "joyful"] },
  "boda": { energy: "media", mood: "romántico y emotivo", tempo: "medio", suggested_elements: ["emotional", "romantic", "elegant", "heartfelt"] },
  "wedding": { energy: "media", mood: "romántico y emotivo", tempo: "medio", suggested_elements: ["emotional", "romantic", "elegant", "heartfelt"] },
  "aniversario": { energy: "media", mood: "nostálgico y romántico", tempo: "medio-lento", suggested_elements: ["warm", "intimate", "nostalgic", "romantic"] },
  "anniversary": { energy: "media", mood: "nostálgico y romántico", tempo: "medio-lento", suggested_elements: ["warm", "intimate", "nostalgic", "romantic"] },
  "graduación": { energy: "alta", mood: "inspirador y orgulloso", tempo: "medio-alto", suggested_elements: ["triumphant", "anthemic", "powerful", "inspiring"] },
  "graduation": { energy: "alta", mood: "inspirador y orgulloso", tempo: "medio-alto", suggested_elements: ["triumphant", "anthemic", "powerful", "inspiring"] },
  
  // 💕 Románticas
  "declaración": { energy: "media", mood: "emotivo y sincero", tempo: "medio", suggested_elements: ["heartfelt", "vulnerable", "intimate", "sincere"] },
  "propuesta": { energy: "media-alta", mood: "emotivo y esperanzador", tempo: "medio", suggested_elements: ["romantic buildup", "emotional", "hopeful", "dramatic"] },
  "pedir matrimonio": { energy: "media-alta", mood: "emotivo y esperanzador", tempo: "medio", suggested_elements: ["romantic", "emotional crescendo", "hopeful", "memorable"] },
  "san valentín": { energy: "media", mood: "romántico y dulce", tempo: "medio", suggested_elements: ["sweet", "romantic", "tender", "dreamy"] },
  "valentine": { energy: "media", mood: "romántico y dulce", tempo: "medio", suggested_elements: ["sweet", "romantic", "tender", "dreamy"] },
  
  // 👨‍👩‍👧 Familiares
  "día de la madre": { energy: "media", mood: "emotivo y agradecido", tempo: "medio-lento", suggested_elements: ["heartwarming", "grateful", "tender", "emotional"] },
  "madre": { energy: "media", mood: "emotivo y agradecido", tempo: "medio-lento", suggested_elements: ["heartwarming", "grateful", "tender", "emotional"] },
  "día del padre": { energy: "media", mood: "emotivo y orgulloso", tempo: "medio", suggested_elements: ["warm", "proud", "sincere", "strong"] },
  "padre": { energy: "media", mood: "emotivo y orgulloso", tempo: "medio", suggested_elements: ["warm", "proud", "sincere", "strong"] },
  
  // 🎄 Festividades
  "navidad": { energy: "media-alta", mood: "festivo y cálido", tempo: "medio", suggested_elements: ["festive", "warm", "joyful", "holiday feel"] },
  "christmas": { energy: "media-alta", mood: "festivo y cálido", tempo: "medio", suggested_elements: ["festive", "warm", "joyful", "holiday feel"] },
  "año nuevo": { energy: "alta", mood: "esperanzador y festivo", tempo: "medio-alto", suggested_elements: ["celebratory", "hopeful", "energetic", "festive"] },
  "new year": { energy: "alta", mood: "esperanzador y festivo", tempo: "medio-alto", suggested_elements: ["celebratory", "hopeful", "energetic", "festive"] },
  
  // 💀 Día de Muertos (muy mexicano)
  "día de muertos": { energy: "media", mood: "nostálgico y emotivo", tempo: "medio-lento", suggested_elements: ["nostalgic", "emotional", "remembrance", "bittersweet", "traditional"] },
  "muertos": { energy: "media", mood: "nostálgico y emotivo", tempo: "medio-lento", suggested_elements: ["nostalgic", "emotional", "remembrance", "bittersweet"] },
  
  // 🙏 Disculpa
  "disculparme": { energy: "baja-media", mood: "vulnerable y sincero", tempo: "lento-medio", suggested_elements: ["vulnerable", "sincere", "emotional", "heartfelt"] },
  "disculpa": { energy: "baja-media", mood: "vulnerable y sincero", tempo: "lento-medio", suggested_elements: ["vulnerable", "sincere", "emotional", "heartfelt"] },
  "perdón": { energy: "baja-media", mood: "vulnerable y sincero", tempo: "lento-medio", suggested_elements: ["vulnerable", "sincere", "emotional", "heartfelt"] },
  
  // Default
  "default": { energy: "media", mood: "emotivo y universal", tempo: "medio", suggested_elements: ["emotional", "catchy", "polished", "memorable melody"] }
}

// Mapeo de propósitos a estilos recomendados
const PURPOSE_STYLE_MAP: Record<string, { vibe: string; production: string; suggested_genre: string }> = {
  "regalo": { vibe: "personal y emotivo", production: "polished", suggested_genre: "pop" },
  "sorpresa": { vibe: "impactante y memorable", production: "dynamic", suggested_genre: "pop" },
  "homenaje": { vibe: "respetuoso y emotivo", production: "warm", suggested_genre: "balada" },
  "dedicatoria": { vibe: "íntimo y sincero", production: "acoustic-leaning", suggested_genre: "pop acústico" },
  "celebración": { vibe: "alegre y festivo", production: "energetic", suggested_genre: "pop latino" },
  "disculpa": { vibe: "vulnerable y sincero", production: "stripped-back", suggested_genre: "balada" },
  "agradecimiento": { vibe: "cálido y emotivo", production: "warm", suggested_genre: "pop" },
  "despedida": { vibe: "nostálgico y emotivo", production: "atmospheric", suggested_genre: "balada" },
  "default": { vibe: "emotivo y universal", production: "polished", suggested_genre: "pop" }
}

// Palabras clave emocionales ampliadas con su mapping a características de producción
const EMOTIONAL_KEYWORDS_MAP: Record<string, { mood: string; production_hint: string }> = {
  // Positivas
  "amor": { mood: "romantic", production_hint: "warm synths, soft percussion" },
  "feliz": { mood: "joyful", production_hint: "bright, upbeat, major key" },
  "alegría": { mood: "happy", production_hint: "energetic, bouncy bass" },
  "esperanza": { mood: "hopeful", production_hint: "building, inspiring" },
  "sueño": { mood: "dreamy", production_hint: "atmospheric, reverb, ethereal" },
  "pasión": { mood: "passionate", production_hint: "intense, dynamic" },
  "fiesta": { mood: "party", production_hint: "danceable, high energy" },
  "bailar": { mood: "dance", production_hint: "groovy, rhythmic" },
  // Nostálgicas
  "nostalgia": { mood: "nostalgic", production_hint: "warm, vintage feel" },
  "recuerdo": { mood: "reminiscent", production_hint: "soft, intimate" },
  "ayer": { mood: "reflective", production_hint: "mellow, thoughtful" },
  // Emotivas
  "triste": { mood: "sad", production_hint: "minor key, slow, emotional" },
  "dolor": { mood: "painful", production_hint: "raw, stripped back" },
  "melancolía": { mood: "melancholic", production_hint: "atmospheric, moody" },
  "llorar": { mood: "tearful", production_hint: "emotional buildup, piano" },
  // Intensas
  "fuerte": { mood: "powerful", production_hint: "big drums, anthemic" },
  "lucha": { mood: "fighting", production_hint: "driving, intense" },
  "victoria": { mood: "triumphant", production_hint: "epic, building" },
  "energía": { mood: "energetic", production_hint: "high tempo, punchy" },
  // Íntimas
  "susurro": { mood: "intimate", production_hint: "close mic, whispered" },
  "secreto": { mood: "mysterious", production_hint: "subtle, soft" },
  "abrazo": { mood: "warm", production_hint: "comforting, gentle" },
  "beso": { mood: "romantic", production_hint: "sweet, tender" }
}

// Géneros seguros que funcionan bien universalmente en Suno
const SAFE_GENRE_COMBINATIONS = [
  "pop latino, melodic, catchy hook, modern production",
  "balada, emotional, piano-driven, heartfelt",
  "acoustic pop, warm, intimate, guitar-based",
  "latin pop, rhythmic, groovy, contemporary",
  "pop rock, energetic, guitar riffs, powerful drums",
  "tropical pop, upbeat, summery, danceable",
  "R&B pop, smooth, soulful, groove",
  "indie pop, dreamy, atmospheric, unique"
]

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 MAPEO COMPLETO DE TODOS LOS GÉNEROS DISPONIBLES
// ═══════════════════════════════════════════════════════════════════════════════
const GENRE_COMPLETE_MAP: Record<string, { style: string; instruments: string; production: string; isRegionalMexican?: boolean }> = {
  // 🇲🇽 GÉNEROS REGIONALES MEXICANOS
  "banda": { 
    style: "banda sinaloense, regional mexicano", 
    instruments: "brass section, trumpets, clarinets, tubas, trombone, tambora drums, snare", 
    production: "powerful brass, punchy percussion, festive, authentic regional",
    isRegionalMexican: true
  },
  "norteño": { 
    style: "norteño, regional mexicano", 
    instruments: "accordion, bajo sexto, bass guitar, drums", 
    production: "authentic, rhythmic, energetic, traditional",
    isRegionalMexican: true
  },
  "sierreño": { 
    style: "sierreño, regional mexicano, campirano", 
    instruments: "requinto sierreño (12-string guitar), guitarra de armonía (6-string), sousaphone bass, tuba, subtle percussion", 
    production: "rural authentic, melodic lines, three-part harmony (melodía, armonía, bajo), intimate, traditional northern Mexico",
    isRegionalMexican: true
  },
  "mariachi": { 
    style: "mariachi, traditional mexican", 
    instruments: "mariachi trumpets, violins, vihuela, guitarrón, guitar", 
    production: "dramatic, festive, powerful vocals, orchestral",
    isRegionalMexican: true
  },
  "ranchera": { 
    style: "ranchera, mariachi", 
    instruments: "mariachi trumpets, violins, vihuela, guitarrón", 
    production: "dramatic, emotional, traditional mexican, powerful vocals",
    isRegionalMexican: true
  },
  "corrido": { 
    style: "corrido, norteño", 
    instruments: "accordion, bajo sexto, tuba bass, drums", 
    production: "storytelling, rhythmic, authentic, bold",
    isRegionalMexican: true
  },
  "corrido tumbado": { 
    style: "corrido tumbado, urban regional mexicano", 
    instruments: "requinto guitar, bass, subtle percussion", 
    production: "laid-back, modern, melodic, intimate",
    isRegionalMexican: true
  },
  
  // 🌴 GÉNEROS TROPICALES/LATINOS
  "cumbia": { 
    style: "cumbia mexicana, tropical", 
    instruments: "accordion, güira, congas, timbales, bass", 
    production: "danceable, upbeat, groovy, festive"
  },
  "vallenato": {
    style: "vallenato, colombian folk",
    instruments: "accordion, caja vallenata, guacharaca, bass guitar",
    production: "folklore, storytelling, rhythmic, sentimental, authentic colombian"
  },
  "salsa": { 
    style: "salsa, latin tropical", 
    instruments: "piano, congas, timbales, brass section, bongos, bass", 
    production: "energetic, danceable, rhythmic, brass hits, percussive"
  },
  "bachata": { 
    style: "bachata, dominican romantic", 
    instruments: "requinto guitar, rhythm guitar, bongos, bass, güira", 
    production: "romantic, sensual, rhythmic, intimate vocals"
  },
  "bolero": {
    style: "bolero, romantic latin",
    instruments: "acoustic guitar, piano, soft strings, bongos",
    production: "romantic, slow, intimate, classic, emotional vocals"
  },
  "reggae": {
    style: "reggae, caribbean",
    instruments: "electric guitar offbeat, bass, drums, organ, percussion",
    production: "laid-back rhythm, offbeat guitar skanks, deep bass lines, positive vibes"
  },

  // 🎤 GÉNEROS URBANOS
  "reggaeton": { 
    style: "reggaeton, latin urban", 
    instruments: "dembow beat, 808 bass, synths, hi-hats", 
    production: "perreo, danceable, catchy, modern, hard-hitting bass"
  },
  "rap": { 
    style: "hip hop, rap en español", 
    instruments: "boom bap drums, 808s, samples, bass", 
    production: "rhythmic flow, hard-hitting, lyrical, urban"
  },
  "trap": { 
    style: "latin trap, trap en español", 
    instruments: "808 bass, hi-hats, dark synths, autotune vocals", 
    production: "heavy bass, atmospheric, dark mood, modern"
  },
  "r&b": { 
    style: "R&B, soul latino", 
    instruments: "smooth synths, electric piano, bass, drums", 
    production: "smooth, soulful, groove, sensual, silky vocals"
  },
  
  // 🎸 GÉNEROS POP/ROCK
  "pop": { 
    style: "pop latino, modern pop", 
    instruments: "synths, electric guitar, bass, drums, piano", 
    production: "catchy, polished, radio-ready, melodic hook"
  },
  "balada": { 
    style: "balada, romantic", 
    instruments: "piano, strings, acoustic guitar, soft drums", 
    production: "emotional, heartfelt, building dynamics, intimate to powerful"
  },
  "rock": { 
    style: "rock, classic rock, english rock", 
    instruments: "electric guitars, bass guitar, drums, power chords", 
    production: "energetic, powerful, guitar-driven, anthemic, english vocals"
  },
  "indie": { 
    style: "indie pop, alternative", 
    instruments: "jangly guitars, synths, bass, drums", 
    production: "dreamy, atmospheric, lo-fi aesthetic, unique"
  },
  
  // 🎻 GÉNEROS TRADICIONALES
  "trova": { 
    style: "trova, cantautor", 
    instruments: "acoustic guitar, soft percussion", 
    production: "intimate, poetic, singer-songwriter, heartfelt, minimalist"
  },
  "country": {
    style: "country, americana",
    instruments: "acoustic guitar, steel guitar, fiddle, bass, drums",
    production: "storytelling, warm, authentic, twangy"
  },

  // 🌎 GÉNEROS FOLKLÓRICOS REGIONALES
  "criolla": {
    style: "música criolla peruana, afro-peruvian",
    instruments: "acoustic guitar, cajón peruano, cajita, quijada",
    production: "rhythmic, soulful, traditional peruvian, warm, coastal"
  },
  "marinera": {
    style: "marinera, peruvian coastal",
    instruments: "guitar, cajón, trumpet optional, handkerchiefs dance rhythm",
    production: "elegant, festive, traditional peruvian dance, rhythmic, graceful"
  },
  "cueca": {
    style: "cueca chilena, traditional chilean",
    instruments: "guitar, accordion, harp, tambourine, handkerchiefs",
    production: "festive, patriotic, traditional dance rhythm, folkloric, celebratory"
  },
  "calipso": {
    style: "calipso costarricense, afro-caribbean costa rican",
    instruments: "guitar, marimba, bongos, bass, percussion",
    production: "caribbean rhythm, festive, cultural, tropical, unique costa rican"
  },
  "huayno": {
    style: "huayno, andean folk",
    instruments: "quena, charango, bombo, zampoña, harp, violin",
    production: "traditional andean, festive or nostalgic, folkloric, indigenous rhythms"
  },

  // Géneros auxiliares
  "huapango": { 
    style: "huapango, son huasteco", 
    instruments: "violin, jarana huasteca, quinta huapanguera", 
    production: "traditional, falsetto vocals, rhythmic, folkloric",
    isRegionalMexican: true
  },
  "grupero": { 
    style: "grupero, romantic mexican", 
    instruments: "keyboards, guitars, bass, drums", 
    production: "romantic, melodic, polished, emotional",
    isRegionalMexican: true
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚫 ESTILOS/MOODS INCOMPATIBLES POR TIPO DE GÉNERO
// ═══════════════════════════════════════════════════════════════════════════════
const INCOMPATIBLE_STYLES: Record<string, { remove: string[]; replaceWith: string[] }> = {
  // Para géneros regionales mexicanos - remover elementos electrónicos/modernos
  "regional_mexican": {
    remove: [
      "electrónica", "electronica", "electronic", "synths", "synth", "edm", 
      "808", "hi-hats", "hi hats", "autotune", "auto-tune", "dembow",
      "trap", "dubstep", "house", "techno", "trance", "bass drop",
      "bright synths", "dark synths", "smooth synths", "groovy bass",
      "intimate", "whispered", "soft", "delicate", "subtle", "minimalist"
    ],
    replaceWith: ["festive", "powerful", "authentic", "traditional", "bold", "energetic"]
  },
  // Para banda sinaloense específicamente - remover elementos no auténticos
  "banda": {
    remove: [
      "intimate", "whispered", "soft", "delicate", "subtle", "minimalist",
      "acoustic", "fingerpicked", "stripped", "lo-fi", "dreamy", "atmospheric",
      "polished", "radio-ready", "pop", "commercial"
    ],
    replaceWith: ["powerful", "festive", "bold", "authentic regional", "energetic", "celebratory"]
  },
  // Para géneros tradicionales/acústicos - remover elementos muy modernos
  "traditional": {
    remove: [
      "electrónica", "electronica", "electronic", "808", "hi-hats", 
      "autotune", "edm", "dembow", "trap beat"
    ],
    replaceWith: ["acoustic", "warm", "intimate", "authentic"]
  }
}

// Función para filtrar estilos incompatibles del combinedStyle
function filterIncompatibleStyles(combinedStyle: string | string[], genreType: "regional_mexican" | "banda" | "corridos_tumbados" | "traditional" | "urban" | "pop" | null): string {
  // Validar que combinedStyle sea string
  if (typeof combinedStyle !== 'string') {
    // Convertir a string si es array, o retornar string vacío
    if (Array.isArray(combinedStyle)) {
      combinedStyle = combinedStyle.join(', ')
    } else {
      combinedStyle = String(combinedStyle || '')
    }
  }
  
  if (!genreType || !INCOMPATIBLE_STYLES[genreType]) {
    return combinedStyle
  }
  
  const rules = INCOMPATIBLE_STYLES[genreType]
  let filteredStyle = combinedStyle.toLowerCase()
  
  // Remover términos incompatibles
  for (const term of rules.remove) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi')
    filteredStyle = filteredStyle.replace(regex, '')
  }
  
  // Limpiar comas y espacios extra
  filteredStyle = filteredStyle
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .replace(/^\s*,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Si quedó muy vacío, agregar términos de reemplazo
  if (filteredStyle.length < 10 && rules.replaceWith.length > 0) {
    filteredStyle = rules.replaceWith.slice(0, 2).join(', ')
  }
  
  return filteredStyle
}

// Función para detectar el género específico
function detectGenre(genre: string | null, combinedStyle: string | string[]): { 
  isRegionalMexican: boolean; 
  genreData: typeof GENRE_COMPLETE_MAP["banda"] | null; 
  detectedGenre: string | null;
  genreType: "regional_mexican" | "banda" | "corridos_tumbados" | "traditional" | "urban" | "pop" | null
} {
  if (!genre && !combinedStyle) return { isRegionalMexican: false, genreData: null, detectedGenre: null, genreType: null }
  
  // Asegurar que combinedStyle sea string
  let combinedStyleStr: string
  if (typeof combinedStyle === 'string') {
    combinedStyleStr = combinedStyle
  } else if (Array.isArray(combinedStyle)) {
    combinedStyleStr = combinedStyle.join(', ')
  } else {
    combinedStyleStr = String(combinedStyle || '')
  }
  
  const textToAnalyze = `${genre || ""} ${combinedStyleStr}`.toLowerCase()
  
  // 🎸 DETECCIÓN PRIORITARIA DE CORRIDO TUMBADO (antes que corrido tradicional)
  if (textToAnalyze.includes("corrido tumbado") || 
      textToAnalyze.includes("corrido tumbado") ||  // Singular también
      textToAnalyze.includes("tumbado") || 
      textToAnalyze.includes("natanael") || 
      textToAnalyze.includes("peso pluma") || 
      textToAnalyze.includes("junior h") || 
      textToAnalyze.includes("fuerza regida") ||
      textToAnalyze.includes("gabito ballesteros") ||  // Agregar Gabito Ballesteros
      // Detectar si es corrido + indicadores modernos
      (textToAnalyze.includes("corrido") && (
        textToAnalyze.includes("modern") || 
        textToAnalyze.includes("laid-back") || 
        textToAnalyze.includes("melodic") || 
        textToAnalyze.includes("intimate") ||
        textToAnalyze.includes("requinto") ||
        textToAnalyze.includes("urban")
      ))) {
    const genreData = GENRE_COMPLETE_MAP["corrido tumbado"]
    console.log("🎸 CORRIDO TUMBADO detectado por:", textToAnalyze)
    return { 
      isRegionalMexican: genreData?.isRegionalMexican || false, 
      genreData: genreData || null, 
      detectedGenre: "corrido tumbado",
      genreType: "corridos_tumbados"
    }
  }
  
  // Buscar coincidencia directa en el mapeo de géneros (usando word boundaries para evitar falsos positivos)
  for (const [key, data] of Object.entries(GENRE_COMPLETE_MAP)) {
    // Usar word boundaries para evitar que "reggae" coincida con "reggaeton"
    const regex = new RegExp(`\\b${key.toLowerCase().replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (regex.test(textToAnalyze)) {
      let genreType: "regional_mexican" | "banda" | "corridos_tumbados" | "traditional" | "urban" | "pop" | null = null
      
      // Casos especiales primero
      if (key === "corrido tumbado") {
        genreType = "corridos_tumbados"
      } else if (key === "banda") {
        genreType = "banda"
      } else if (data.isRegionalMexican) {
        genreType = "regional_mexican"
      } else if (["trova", "country", "bolero"].includes(key)) {
        genreType = "traditional"
      } else if (["reggaeton", "rap", "trap", "r&b"].includes(key)) {
        genreType = "urban"
      } else {
        genreType = "pop"
      }
      
      return { 
        isRegionalMexican: data.isRegionalMexican || false, 
        genreData: data, 
        detectedGenre: key,
        genreType
      }
    }
  }
  
  // Detectar variantes y sinónimos comunes
  const genreKeywords = [
    // Regionales mexicanos
    { keywords: ["sinaloense", "sinaloa"], genre: "banda" },
    { keywords: ["tumbado", "natanael", "peso pluma", "junior h", "fuerza regida", "gabito ballesteros"], genre: "corrido tumbado" },
    { keywords: ["tierra caliente", "campirano", "sierreña", "música sierreña", "requinto sierreño", "sousaphone"], genre: "sierreño" },
    { keywords: ["regional mexican", "regional mexicano", "música regional"], genre: "banda" },
    { keywords: ["tuba", "tambora"], genre: "banda" },
    { keywords: ["acordeón", "accordion", "bajo sexto"], genre: "norteño" },
    { keywords: ["ranchero", "rancheras"], genre: "ranchera" },
    // Urbanos
    { keywords: ["perreo", "dembow", "bad bunny", "daddy yankee"], genre: "reggaeton" },
    { keywords: ["hip hop", "hiphop", "rapero"], genre: "rap" },
    { keywords: ["trapero", "latin trap"], genre: "trap" },
    { keywords: ["rnb", "rhythm and blues"], genre: "r&b" },
    // Tropicales
    { keywords: ["salsero", "salsa dura", "salsa romantica"], genre: "salsa" },
    { keywords: ["bachatera", "romeo santos", "aventura"], genre: "bachata" },
    { keywords: ["cumbiero", "cumbia sonidera"], genre: "cumbia" },
    { keywords: ["vallenato", "ballenato", "valledupar", "caja vallenata", "guacharaca", "binomio", "diomedes", "silvestre", "vives"], genre: "vallenato" },
    // Pop/Rock
    { keywords: ["balada romantica", "power ballad"], genre: "balada" },
    { keywords: ["rock alternativo", "rock latino"], genre: "rock" },
    { keywords: ["cantautor", "singer songwriter"], genre: "trova" },
    // Caribeños
    { keywords: ["bob marley", "roots reggae", "one drop", "skank"], genre: "reggae" },
    // Folklóricos regionales
    { keywords: ["musica criolla", "criolla peruana", "cajón peruano", "festejo", "landó", "tondero"], genre: "criolla" },
    { keywords: ["marinera norteña", "marinera limeña", "danza peruana"], genre: "marinera" },
    { keywords: ["cueca chilena", "baile nacional", "fiesta patria"], genre: "cueca" },
    { keywords: ["calipso limonense", "afro costarricense", "limon"], genre: "calipso" },
    { keywords: ["andean", "andina", "quena", "charango", "zampoña", "bombo andino"], genre: "huayno" },
  ]
  
  for (const variant of genreKeywords) {
    for (const keyword of variant.keywords) {
      // Usar word boundaries para evitar falsos positivos
      const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i')
      if (regex.test(textToAnalyze)) {
        const genreData = GENRE_COMPLETE_MAP[variant.genre]
        let genreType: "regional_mexican" | "banda" | "corridos_tumbados" | "traditional" | "urban" | "pop" | null = null
        
        // Casos especiales primero
        if (variant.genre === "corrido tumbado") {
          genreType = "corridos_tumbados"
        } else if (variant.genre === "banda") {
          genreType = "banda"
        } else if (genreData?.isRegionalMexican) {
          genreType = "regional_mexican"
        } else if (["trova", "country", "bolero"].includes(variant.genre)) {
          genreType = "traditional"
        } else if (["reggaeton", "rap", "trap", "r&b"].includes(variant.genre)) {
          genreType = "urban"
        } else {
          genreType = "pop"
        }
        
        return { 
          isRegionalMexican: genreData?.isRegionalMexican || false, 
          genreData: genreData || null, 
          detectedGenre: variant.genre,
          genreType
        }
      }
    }
  }
  
  return { isRegionalMexican: false, genreData: null, detectedGenre: null, genreType: null }
}

function analyzeEmotionalContent(lyrics: string): { dominantMood: string; productionHints: string[]; intensity: string } {
  const lyricsLower = typeof lyrics === 'string' ? lyrics.toLowerCase() : ''
  const foundEmotions: { mood: string; hint: string; count: number }[] = []
  
  for (const [keyword, data] of Object.entries(EMOTIONAL_KEYWORDS_MAP)) {
    const regex = new RegExp(keyword, 'gi')
    const matches = lyricsLower.match(regex)
    if (matches) {
      foundEmotions.push({ mood: data.mood, hint: data.production_hint, count: matches.length })
    }
  }
  
  // Ordenar por frecuencia
  foundEmotions.sort((a, b) => b.count - a.count)
  
  // Determinar intensidad por signos de exclamación y mayúsculas
  const exclamations = (lyrics.match(/!/g) || []).length
  const intensity = exclamations > 5 ? "alta" : exclamations > 2 ? "media" : "suave"
  
  return {
    dominantMood: foundEmotions[0]?.mood || "emotional",
    productionHints: foundEmotions.slice(0, 3).map(e => e.hint),
    intensity
  }
}

function getOccasionData(occasion: string | null): typeof OCCASION_MUSIC_MAP["default"] {
  if (!occasion || typeof occasion !== 'string') return OCCASION_MUSIC_MAP["default"]
  const occasionLower = occasion.toLowerCase()
  
  for (const [key, value] of Object.entries(OCCASION_MUSIC_MAP)) {
    if (occasionLower.includes(key)) return value
  }
  return OCCASION_MUSIC_MAP["default"]
}

function getPurposeData(purpose: string | null): typeof PURPOSE_STYLE_MAP["default"] {
  if (!purpose || typeof purpose !== 'string') return PURPOSE_STYLE_MAP["default"]
  const purposeLower = purpose.toLowerCase()
  
  for (const [key, value] of Object.entries(PURPOSE_STYLE_MAP)) {
    if (purposeLower.includes(key)) return value
  }
  return PURPOSE_STYLE_MAP["default"]
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    let { combinedStyle, orderId, lyrics, genre, purpose, occasion, voice_gender } = body

    // Normalizar combinedStyle: convertir array a string si es necesario
    if (Array.isArray(combinedStyle)) {
      combinedStyle = combinedStyle.join(', ')
    }

    // Validar que combinedStyle sea string después de normalización
    if (!combinedStyle || typeof combinedStyle !== 'string') {
      return NextResponse.json({ success: false, message: "combinedStyle must be a string or array" }, { status: 400 })
    }

    // Verificar si al menos una API key está disponible
    const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY
    if (!apiKey) {
      console.error("Neither GEMINI_API_KEY nor GROQ_API_KEY environment variables are set")
      return NextResponse.json({ success: false, message: "API configuration error" }, { status: 500 })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🧠 ANÁLISIS INTELIGENTE DE CONTEXTO
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Analizar la ocasión para obtener características recomendadas
    const occasionData = getOccasionData(occasion)
    
    // Analizar el propósito
    const purposeData = getPurposeData(purpose)
    
    // Analizar contenido emocional de la letra
    let emotionalAnalysis = { dominantMood: "emotional", productionHints: [] as string[], intensity: "media" }
    if (lyrics && lyrics.length > 50) {
      emotionalAnalysis = analyzeEmotionalContent(lyrics)
    }
    
    // 🎵 DETECTAR GÉNERO ESPECÍFICO
    const detectedGenre = detectGenre(genre, combinedStyle)
    console.log("🔍 Detección de género:")
    console.log("  - Género enviado:", genre)
    console.log("  - Combined style:", combinedStyle)
    console.log("  - Género detectado:", detectedGenre.detectedGenre)
    console.log("  - Tipo de género:", detectedGenre.genreType)

    // ═══════════════════════════════════════════════════════════════════════════
    // 🎯 SI DETECTAMOS EL GÉNERO, USAR DEFINICIÓN DIRECTA (SIN IA)
    // ═══════════════════════════════════════════════════════════════════════════
    let generatedStyle = ""

    if (detectedGenre.genreData) {
      // ✅ GÉNERO DETECTADO - Construir estilo directamente del mapa
      console.log(`✅ Género detectado: ${detectedGenre.detectedGenre} - Usando definición del mapa (sin IA)`)

      generatedStyle = `${detectedGenre.genreData.style}, ${detectedGenre.genreData.instruments}, ${detectedGenre.genreData.production}`
        .substring(0, 200)
        .trim()

      console.log(`🎵 Estilo generado (sin IA): ${generatedStyle}`)
    } else if (genre && typeof genre === 'string' && genre.trim().length > 0) {
      // ═══════════════════════════════════════════════════════════════════════════
      // 🎵 GÉNERO NO RECONOCIDO - PASAR TAL CUAL PARA QUE SUNO LO INTERPRETE
      // ═══════════════════════════════════════════════════════════════════════════
      console.log(`⚠️ Género "${genre}" no está en el mapa - Pasando tal cual a Suno`)
      generatedStyle = genre.trim().substring(0, 200)
      console.log(`🎵 Estilo generado (género directo): ${generatedStyle}`)
    } else {
      // ═══════════════════════════════════════════════════════════════════════════
      // 🤖 SIN GÉNERO ESPECIFICADO - USAR IA COMO FALLBACK
      // ═══════════════════════════════════════════════════════════════════════════
      console.log("⚠️ Sin género especificado - Usando IA como fallback")

    // 🚫 FILTRAR ESTILOS INCOMPATIBLES ANTES DEL PROMPT
    let filteredCombinedStyle = combinedStyle
    if (detectedGenre.genreType) {
      filteredCombinedStyle = filterIncompatibleStyles(combinedStyle, detectedGenre.genreType)
      if (filteredCombinedStyle !== combinedStyle) {
        console.log(`🚫 Estilos filtrados para ${detectedGenre.detectedGenre}:`)
        console.log(`   Original: ${combinedStyle}`)
        console.log(`   Filtrado: ${filteredCombinedStyle}`)
      }
    }
    
    // Construir contexto enriquecido
    let contextAnalysis = `
═══ ANÁLISIS PROFUNDO DEL PEDIDO ═══

📌 GÉNERO SOLICITADO: ${genre || "No especificado - usar pop como base segura"}
${detectedGenre.genreData ? `
🎵 GÉNERO ESPECÍFICO DETECTADO: ${detectedGenre.detectedGenre?.toUpperCase()}
   → Estilo base: ${detectedGenre.genreData.style}
   → Instrumentación característica: ${detectedGenre.genreData.instruments}
   → Producción recomendada: ${detectedGenre.genreData.production}
${detectedGenre.detectedGenre === "corrido tumbado" ? `
   🎸 ¡¡¡CORRIDO TUMBADO DETECTADO!!!
   ⚠️ ESTO ES CRÍTICO - NO ES CORRIDO TRADICIONAL
   ❌ NUNCA usar: accordion, acordeón, bajo sexto, tuba bass, tuba, tambora, drums
   ✅ USAR SOLO: requinto guitar, acoustic guitar, bass, subtle percussion
   ✅ ESTILO: laid-back, melodic, intimate, urban regional mexicano
` : detectedGenre.isRegionalMexican ? `
   🇲🇽 ¡¡¡ATENCIÓN!!! ESTE ES UN GÉNERO REGIONAL MEXICANO
   ⚠️ ESTO ES CRÍTICO - DEBES RESPETAR LA IDENTIDAD DEL GÉNERO
   ❌ NO usar synths electrónicos, NO usar elementos de pop/EDM
   ✅ USAR instrumentación tradicional: ${detectedGenre.genreData.instruments}
   ✅ MANTENER autenticidad del género regional mexicano
` : ""}` : ""}
🎯 PROPÓSITO: ${purpose || "No especificado"}
   → Vibra recomendada: ${purposeData.vibe}
   → Tipo de producción: ${purposeData.production}
   → Género sugerido base: ${detectedGenre.genreData ? detectedGenre.genreData.style : purposeData.suggested_genre}

🎉 OCASIÓN: ${occasion || "No especificada"}
   → Energía recomendada: ${occasionData.energy}
   → Mood objetivo: ${occasionData.mood}
   → Tempo sugerido: ${occasionData.tempo}
   → Elementos clave: ${detectedGenre.genreData 
      ? detectedGenre.genreData.instruments 
      : (detectedGenre.isRegionalMexican 
          ? occasionData.suggested_elements.filter(e => !["bright synths", "groovy bass", "synths"].includes(e)).join(", ") || "festive, powerful, authentic"
          : occasionData.suggested_elements.join(", "))}

💭 ANÁLISIS EMOCIONAL DE LA LETRA:
   → Mood dominante: ${emotionalAnalysis.dominantMood}
   → Intensidad detectada: ${emotionalAnalysis.intensity}
   → Pistas de producción: ${emotionalAnalysis.productionHints.join("; ") || "Usar producción versátil"}

🎤 GÉNERO DE VOZ: ${voice_gender || "No especificado"}

📝 REFERENCIAS DEL USUARIO (FILTRADAS): ${filteredCombinedStyle}
`

    // ═══════════════════════════════════════════════════════════════════════════
    // 🎨 EL PROMPT MAESTRO PARA SUNO AI
    // ═══════════════════════════════════════════════════════════════════════════
    
    const prompt = `Eres el MEJOR productor musical del mundo especializado en crear descripciones de estilo perfectas para Suno AI. Tu trabajo es que CADA canción suene profesional, emotiva y universalmente atractiva.

${contextAnalysis}

═══════════════════════════════════════════════════════════════════════════════
🎯 TU MISIÓN: Crear un estilo que haga que esta canción sea INOLVIDABLE
═══════════════════════════════════════════════════════════════════════════════

REGLAS DE ORO PARA SUNO AI:

⚠️ REGLA CRÍTICA PARA CORRIDO TUMBADO:
Si detectas "corrido tumbado", "tumbado", "Peso Pluma", "Natanael Cano" o similares:
❌ NUNCA uses: accordion, acordeón, bajo sexto, tuba bass, tuba, tambora, drums
✅ USA SOLO: requinto guitar, acoustic guitar, bass, subtle percussion
El corrido tumbado es DIFERENTE al corrido tradicional en instrumentación.

1️⃣ ESTRUCTURA PERFECTA DEL ESTILO (orden importa):
   [Género principal], [Subgénero/Mood], [Instrumentación clave], [Características vocales], [Producción/Efectos]
   
2️⃣ GÉNEROS DISPONIBLES PARA PÚBLICO MEXICANO (ORDENADOS POR POPULARIDAD):

   🇲🇽 REGIONAL MEXICANO (LOS MÁS IMPORTANTES - RESPETAR 100% SU IDENTIDAD):
   ⚠️ CRÍTICO: NO usar synths, NO electrónica, NO elementos de pop moderno
   
   • Banda Sinaloense → brass section potente, trompetas, tubas, clarinetes, trombón, tambora, tarola
     VOZ: Potente, con sentimiento, estilo regional
   • Norteño → acordeón protagonista, bajo sexto, ritmo de polka, tololoche
     VOZ: Auténtica, con acento norteño, emotiva
   • Sierreño → requinto sierreño (guitarra de 12 cuerdas), guitarra de armonía (6 cuerdas), sousaphone o tuba (bajo), percusión sutil
     VOZ: Rural auténtica, con falsetes ocasionales, estilo campirano del norte de México
     ⚠️ IMPORTANTE: El requinto sierreño es una guitarra común de 12 cuerdas, NO un requinto tradicional
     ✅ Instrumentación correcta: 12-string guitar (melodía), 6-string guitar (armonía), sousaphone/tuba (bajo)
     ✅ Características: Tres entradas musicales (armonía, melodía, bajo), sonido de regiones rurales del norte
   • Mariachi → trompetas brillantes, violines, guitarrón, vihuela, guitarra
     VOZ: Dramática, potente, con vibrato, estilo clásico mexicano
   • Ranchera → igual que mariachi pero más enfocada en la voz emotiva
     VOZ: Muy emotiva, desgarradora, con sentimiento profundo
   • Corrido Tradicional → acordeón, bajo sexto, tuba, tambora
     VOZ: Narrativa, clara, estilo storytelling
   • Grupero → teclados, guitarras, bajo, batería
     VOZ: Romántica, clara, estilo balada mexicana
   • Huapango → violín, jarana huasteca, guitarra quinta
     VOZ: Falsete tradicional, muy agudo, folklórico

   🎸 CORRIDO TUMBADO (GÉNERO MODERNO - INSTRUMENTACIÓN ESPECÍFICA):
   ⚠️ IMPORTANTE: Este género es DIFERENTE del corrido tradicional
   ❌ NO usar: acordeón, bajo sexto, tuba, tambora (esos son de corrido tradicional)
   ✅ USAR SOLO: requinto guitar, acoustic guitar, bass, subtle percussion
   • Corrido Tumbado → requinto guitar, acoustic guitar, bass, subtle percussion, NO accordion, NO tuba
     VOZ: Relajada, melódica, moderna pero auténtica (estilo Peso Pluma, Natanael Cano)
     ESTILO: laid-back, melodic, intimate, urban regional mexicano

   🌴 TROPICAL (MUY POPULAR EN MÉXICO):
   • Cumbia Mexicana → acordeón, güiro, congas, timbales, bajo, teclados
     VOZ: Alegre, bailable, festiva
   • Vallenato → acordeón, caja vallenata, guacharaca, bajo
     VOZ: Sentimental, narrativa, auténtica, estilo colombiano
   • Cumbia Sonidera → sintetizadores, efectos, bajo pesado, samples
     VOZ: Con efectos, estilo sonidero
   • Salsa → piano, congas, timbales, trompetas, trombones, bongós
     VOZ: Energética, con sabor, improvisación
   • Bachata → requinto, guitarra rítmica, bongós, güira, bajo
     VOZ: Romántica, sensual, íntima
   • Bolero → guitarra acústica, piano, cuerdas suaves, bongós
     VOZ: Muy romántica, lenta, interpretación profunda
   • Reggae → guitarra eléctrica offbeat, bajo, batería, órgano, percusión
     VOZ: Relajada, positiva, con groove caribeño

   🎤 URBANO LATINO (POPULAR EN JÓVENES MEXICANOS):
   • Reggaeton → dembow beat, 808 bass, synths, hi-hats, perreo
     VOZ: Rítmica, pegadiza, con flow
   • Rap en Español → boom bap, 808s, samples, beats contundentes
     VOZ: Flow lírico, rítmico, con mensaje
   • Trap Latino → 808 bass profundo, hi-hats rápidos, autotune, atmósfera oscura
     VOZ: Con autotune, melódica, moderna
   • R&B Latino → synths suaves, piano eléctrico, bajo groove, batería suave
     VOZ: Suave, sensual, con soul

   🎸 POP/ROCK EN ESPAÑOL:
   • Pop Latino → synths modernos, guitarra, bajo, batería, melodía pegadiza
     VOZ: Clara, comercial, radio-friendly
   • Balada → piano protagonista, cuerdas, guitarra acústica, batería suave
     VOZ: Muy emotiva, con crescendos, interpretación profunda
   • Rock → guitarras eléctricas, power chords, bajo, batería potente
     VOZ: Potente, enérgica, en inglés (más común y auténtico)
   • Indie → guitarras jangly, synths atmosféricos, producción lo-fi
     VOZ: Única, alternativa, con personalidad

   🎻 OTROS:
   • Trova → guitarra acústica sola, percusión mínima
     VOZ: Íntima, poética, de cantautor
   • Country → guitarra acústica, steel guitar, fiddle, bajo
     VOZ: Narrativa, cálida, estilo storytelling

   🌎 FOLKLÓRICOS REGIONALES:
   • Criolla (Perú) → guitarra acústica, cajón peruano, cajita, quijada
     VOZ: Soulful, tradicional, afro-peruana
   • Marinera (Perú) → guitarra, cajón, trompeta opcional, ritmo de danza
     VOZ: Elegante, festiva, tradicional
   • Cueca (Chile) → guitarra, acordeón, arpa, pandereta
     VOZ: Festiva, patriótica, folklórica
   • Calipso (Costa Rica) → guitarra, marimba, bongós, percusión
     VOZ: Caribeña, festiva, cultural afro-costarricense
   • Huayno (Andino) → quena, charango, bombo, zampoña
     VOZ: Andina tradicional, festiva o nostálgica

   ⚠️ REGLAS CRÍTICAS:
   1. Para REGIONAL MEXICANO: NUNCA usar synths, beats electrónicos o elementos de pop
   2. Para TROPICAL: Respetar la percusión característica de cada género
   3. Para URBANO: Usar los beats y producción moderna característica
   4. SIEMPRE incluir el tipo de voz apropiado para el género
   
3️⃣ TAGS DE PRODUCCIÓN QUE MEJORAN CUALQUIER CANCIÓN:
   • "polished production" → sonido profesional
   • "catchy melody" → memorable
   • "emotional dynamics" → impacto emocional
   • "radio-ready" → calidad comercial
   • "anthemic" → para momentos épicos
   • "intimate" → para momentos personales

4️⃣ INSTRUMENTACIÓN INTELIGENTE:
   • ROMÁNTICO: piano, strings, acoustic guitar, soft synths
   • CELEBRACIÓN: bright synths, groovy bass, punchy drums
   • NOSTÁLGICO: warm pads, acoustic elements, subtle reverb
   • ENERGÉTICO: driving drums, electric guitar, powerful bass
   • ÍNTIMO: fingerpicked guitar, soft piano, minimal percussion

5️⃣ EFECTOS VOCALES SEGÚN CONTEXTO:
   • Emotivo: "heartfelt vocals", "emotional delivery"
   • Alegre: "bright vocals", "joyful tone"
   • Íntimo: "intimate vocals", "close mic feel"
   • Poderoso: "powerful vocals", "anthemic"

═══════════════════════════════════════════════════════════════════════════════
⚠️ PROHIBICIONES ABSOLUTAS:
═══════════════════════════════════════════════════════════════════════════════
❌ NUNCA nombres de artistas, bandas o canciones específicas
❌ NUNCA comillas de ningún tipo en la respuesta
❌ NUNCA mezclar géneros incompatibles (ej: death metal con música infantil)
❌ NUNCA usar términos muy técnicos de nicho (ej: "sidechain compression" - Suno no entiende esto)
❌ NUNCA estilos que suenen amateur o de baja calidad

═══════════════════════════════════════════════════════════════════════════════
🎵 EJEMPLOS DE ESTILOS PERFECTOS PARA SUNO:
═══════════════════════════════════════════════════════════════════════════════

Para CUMPLEAÑOS ROMÁNTICO:
→ latin pop, romantic ballad, acoustic guitar, warm piano, emotional vocals, celebratory mood, polished production

Para BODA/ANIVERSARIO:
→ balada, romantic, strings arrangement, heartfelt piano, intimate vocals, emotional crescendo, cinematic

Para REGALO FAMILIAR:
→ acoustic pop, warm, fingerpicked guitar, gentle percussion, sincere vocals, heartwarming, intimate production

Para CELEBRACIÓN/FIESTA:
→ latin pop, upbeat, bright synths, groovy bass, joyful vocals, danceable rhythm, feel-good energy

Para DECLARACIÓN DE AMOR:
→ pop latino, romantic, acoustic guitar, soft synths, vulnerable vocals, building dynamics, emotional

Para HOMENAJE/DESPEDIDA:
→ emotional ballad, nostalgic, piano-driven, strings, heartfelt vocals, atmospheric, bittersweet

Para ENERGÉTICO/MOTIVACIONAL:
→ pop rock, anthemic, powerful drums, electric guitar, passionate vocals, building energy, triumphant

═══════════════════════════════════════════════════════════════════════════════
🎵 EJEMPLOS POR GÉNERO ESPECÍFICO (USA ESTOS COMO GUÍA):
═══════════════════════════════════════════════════════════════════════════════

🇲🇽 GÉNEROS REGIONALES MEXICANOS (CRÍTICO - RESPETAR IDENTIDAD):

Para BANDA (festivo):
→ banda sinaloense, regional mexicano, brass section, trumpets, tubas, clarinets, tambora, powerful vocals, festive, celebratory, authentic

Para BANDA (romántico):
→ banda sinaloense romantica, regional mexicano, brass section, trumpets, tubas, tambora, heartfelt vocals, passionate, emotional, powerful

Para NORTEÑO:
→ norteño, regional mexicano, accordion, bajo sexto, polka rhythm, authentic, energetic, traditional

Para SIERREÑO:
→ sierreño, regional mexicano, campirano, requinto sierreño 12-string guitar melodía, guitarra armonía 6-string, sousaphone bass, three-part harmony, rural northern Mexico, authentic, melodic lines, traditional

Para MARIACHI:
→ mariachi, traditional mexican, trumpets, violins, guitarrón, vihuela, dramatic, powerful vocals, orchestral

Para RANCHERA:
→ ranchera, mariachi style, trumpets, violins, guitarrón, dramatic, emotional, powerful vocals, traditional mexican

Para CORRIDO TRADICIONAL (NO es corrido tumbado):
→ corrido, norteño style, accordion, bajo sexto, tuba bass, storytelling, bold, authentic mexican, rhythmic

Para CORRIDO TUMBADO (MODERNO - DIFERENTE AL TRADICIONAL):
⚠️ CRÍTICO: NUNCA usar accordion, bajo sexto, tuba - esos son del corrido tradicional
→ corrido tumbado, urban regional mexicano, requinto guitar, acoustic guitar, bass, subtle percussion, laid-back rhythm, melodic, intimate vocals, modern

Para GRUPERO:
→ grupero, romantic mexican, keyboards, guitars, bass, melodic, polished, emotional, romantic ballad

Para HUAPANGO:
→ huapango, son huasteco, violin, jarana, falsetto vocals, traditional, folkloric, rhythmic, festive

🌴 GÉNEROS TROPICALES:

Para CUMBIA:
→ cumbia mexicana, tropical, accordion, güira, congas, timbales, danceable, upbeat, festive

Para VALLENATO:
→ vallenato, colombian folk, accordion, caja vallenata, guacharaca, bass guitar, storytelling, sentimental, authentic

Para SALSA:
→ salsa, latin tropical, piano, congas, timbales, brass section, energetic, danceable, rhythmic

Para BACHATA:
→ bachata, dominican romantic, requinto guitar, bongos, güira, sensual, rhythmic, intimate vocals

Para BOLERO:
→ bolero, romantic latin, acoustic guitar, piano, soft strings, slow, intimate, emotional vocals

Para REGGAE:
→ reggae, caribbean, electric guitar offbeat, bass, drums, organ, laid-back rhythm, positive vibes

🎤 GÉNEROS URBANOS:

Para REGGAETON:
→ reggaeton, latin urban, dembow beat, 808 bass, synths, hi-hats, danceable, catchy, perreo

Para RAP:
→ hip hop, rap en español, boom bap drums, 808s, hard-hitting bass, lyrical flow, urban

Para TRAP:
→ latin trap, trap en español, 808 bass, hi-hats, dark synths, autotune vocals, atmospheric, heavy bass

Para R&B:
→ R&B latino, soul, smooth synths, electric piano, groove, soulful, sensual, silky vocals

🎸 POP/ROCK:

Para POP:
→ pop latino, modern pop, synths, catchy melody, polished production, radio-ready, melodic hook

Para BALADA:
→ balada, romantic, piano, strings, heartfelt vocals

Para ROCK:
→ rock, classic rock, electric guitars, power chords, drums, energetic, guitar-driven, anthemic, english vocals

Para INDIE:
→ indie pop, alternative, jangly guitars, dreamy synths, atmospheric, lo-fi aesthetic, unique

🎻 TRADICIONALES:

Para TROVA:
→ trova, cantautor, acoustic guitar, soft percussion, intimate, poetic, singer-songwriter, minimalist

Para COUNTRY:
→ country, americana, acoustic guitar, steel guitar, fiddle, storytelling, warm, authentic, twangy

🌎 GÉNEROS FOLKLÓRICOS REGIONALES:

Para CRIOLLA (Perú):
→ música criolla peruana, afro-peruvian, acoustic guitar, cajón peruano, rhythmic, soulful, traditional, warm

Para MARINERA (Perú):
→ marinera, peruvian coastal, guitar, cajón, elegant, festive, traditional dance rhythm, graceful

Para CUECA (Chile):
→ cueca chilena, traditional chilean, guitar, accordion, harp, festive, patriotic, folkloric, celebratory

Para CALIPSO (Costa Rica):
→ calipso costarricense, afro-caribbean, guitar, marimba, bongos, festive, tropical, unique costa rican

Para HUAYNO (Andino - Bolivia/Perú):
→ huayno, andean folk, quena, charango, bombo, traditional andean, festive, folkloric, indigenous rhythms

═══════════════════════════════════════════════════════════════════════════════
📤 RESPUESTA REQUERIDA:
═══════════════════════════════════════════════════════════════════════════════

Genera ÚNICAMENTE el estilo optimizado para Suno AI.
- Máximo 120 caracteres
- Sin explicaciones ni texto adicional
- Sin comillas ni puntuación innecesaria al final
- Usa inglés para los tags de producción (Suno responde mejor)
- Mantén el género en español/spanglish si es apropiado

GENERA EL ESTILO PERFECTO AHORA:`

    // Llamar a la API con fallback
    const result = await generateTextWithFallback({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 200,
    })

    console.log(`[generate-style] Generado con IA: ${result.provider}`)

    // Extraer y limpiar el estilo generado por IA
    generatedStyle = result.text || ""

    // Limpieza exhaustiva del estilo
    generatedStyle = generatedStyle
      .replace(/^["']|["']$/g, "") // Eliminar comillas al inicio y final
      .replace(/\n/g, " ") // Reemplazar saltos de línea con espacios
      .replace(/\s+/g, " ") // Normalizar espacios múltiples
      .replace(/[.,;]\s*$/, "") // Eliminar puntuación final innecesaria
      .replace(/^(estilo|style|música|music):\s*/i, "") // Eliminar prefijos comunes
      .trim()
      .substring(0, 200) // Limitar a 200 caracteres máximo
      .trim()
    }

    // 🚫 VALIDACIÓN CRÍTICA PARA CORRIDO TUMBADO (aplicar tanto a género detectado como a IA)
    if (detectedGenre.detectedGenre === "corrido tumbado") {
      console.log("🎸 Detectado corrido tumbado - aplicando limpieza específica")
      console.log("Estilo antes de limpieza:", generatedStyle)
      
      // Remover instrumentos de corrido tradicional
      generatedStyle = generatedStyle
        .replace(/\b(accordion|acordeón|bajo sexto|tuba bass|tuba|tambora|drums)\b/gi, "")
        .replace(/,\s*,/g, ",") // Limpiar comas dobles
        .replace(/,\s*$/g, "") // Limpiar coma final
        .replace(/^\s*,/g, "") // Limpiar coma inicial
        .replace(/\s+/g, " ") // Normalizar espacios
        .trim()
      
      // Si quedó muy vacío, usar el estilo base de corrido tumbado
      if (generatedStyle.length < 20) {
        generatedStyle = "corrido tumbado, urban regional mexicano, requinto guitar, acoustic guitar, bass, subtle percussion, laid-back, melodic, intimate vocals"
      }
      
      // Asegurar que tenga los instrumentos correctos si no los tiene
      if (!generatedStyle.includes("requinto") && !generatedStyle.includes("acoustic guitar")) {
        generatedStyle = `corrido tumbado, ${generatedStyle}, requinto guitar, acoustic guitar, bass, subtle percussion`
          .replace(/,\s*,/g, ",")
          .replace(/^\s*,/g, "")
          .trim()
      }
      
      console.log("Estilo después de limpieza:", generatedStyle)
    }

    // 🎺 VALIDACIÓN ESPECÍFICA PARA BANDA SINALOENSE
    if (detectedGenre.detectedGenre === "banda") {
      console.log("🎺 Detectado banda sinaloense - aplicando limpieza específica")
      console.log("Estilo antes de limpieza:", generatedStyle)
      
      // Remover elementos no auténticos de banda
      generatedStyle = generatedStyle
        .replace(/\b(intimate|whispered|soft|delicate|subtle|minimalist|acoustic|fingerpicked|stripped|lo-fi|dreamy|atmospheric|polished|radio-ready)\b/gi, "")
        .replace(/emotional tuba/gi, "powerful tuba") // Corregir "emotional tuba"
        .replace(/,\s*,/g, ",") // Limpiar comas dobles
        .replace(/,\s*$/g, "") // Limpiar coma final
        .replace(/^\s*,/g, "") // Limpiar coma inicial
        .replace(/\s+/g, " ") // Normalizar espacios
        .trim()
      
      // Asegurar que tenga elementos auténticos de banda
      if (!generatedStyle.includes("powerful") && !generatedStyle.includes("festive") && !generatedStyle.includes("bold")) {
        generatedStyle = `${generatedStyle}, powerful, festive, authentic regional`
          .replace(/^,\s*/, "")
          .trim()
      }
      
      console.log("Estilo después de limpieza:", generatedStyle)
    }

    // Validar que el estilo no esté vacío
    if (!generatedStyle || generatedStyle.length < 5) {
      console.warn("Generated style is too short, using fallback")
      // combinedStyle ya está normalizado como string arriba (línea 479)
      generatedStyle = combinedStyle.substring(0, 150).trim()
    }

    // Añadir el género de voz al final del estilo generado
    if (voice_gender && typeof voice_gender === 'string') {
      const voiceGenderLower = voice_gender.toLowerCase()
      if (voiceGenderLower !== 'any') {
        const voiceTag = voiceGenderLower === 'male' ? 'male vocals' :
                         voiceGenderLower === 'female' ? 'female vocals' :
                         voice_gender
        generatedStyle = `${generatedStyle}, ${voiceTag}`.substring(0, 200).trim()
      }
    }

    // Guardar el estilo generado en la base de datos si se proporciona orderId
    if (orderId && supabaseAdmin) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({
            generated_style: generatedStyle,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)

        if (updateError) {
          console.error("Error saving generated style to database:", updateError)
          // No fallamos la request si solo falla el guardado
        } else {
          console.log("Generated style saved successfully to database for order:", orderId)
        }
      } catch (dbError) {
        console.error("Error in database save operation:", dbError)
        // No fallamos la request si solo falla el guardado
      }
    }

    return NextResponse.json({ success: true, style: generatedStyle })
  } catch (error) {
    console.error("Error processing Gemini style request:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    )
  }
}