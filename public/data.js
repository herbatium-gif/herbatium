// Baza de date ingrediente cosmetice naturale — nume uzual -> INCI, funcție, restricții UE
// Sursă: Regulamentul (CE) 1223/2009, Anexele II/III/V/VI + cunoștințe general acceptate din cosmetică artizanală.
// Concentrațiile "max" sunt limite legale UE cunoscute; unde nu există restricție explicită, e marcat null.
// Acest fișier NU este un substitut pentru un dosar CPSR/CPNP întocmit de un evaluator de siguranță autorizat.
// IMPORTANT (2026): Anexa III (alergeni de parfum de declarat pe etichetă) a fost extinsă de la 26 la
// 82 de substanțe prin Regulamentul (UE) 2023/1545 — obligatoriu pt. produse puse pe piață pentru prima
// dată din 31.07.2026, iar pt. produsele deja pe piață până la 31.07.2028. Câmpul `alergen:true` de mai
// jos marchează conservator ingredientele deja cunoscute ca surse de alergeni — NU este o listă completă
// și verificată a celor 82 de substanțe. Pentru orice rețetă/etichetă nouă, verifică formula finală
// contra Anexei III curente (CosIng) sau cu un evaluator de siguranță CPNP.

const INGREDIENTS = [
  // ===== ULEIURI VEGETALE / CARIER =====
  {id:"ulei-masline", ro:"Ulei de măsline", inci:"Olea Europaea (Olive) Fruit Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient", maxPct:null, alergen:false, nota:""},
  {id:"ulei-cocos", ro:"Ulei de cocos", inci:"Cocos Nucifera (Coconut) Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient, întăritor spumă (săpun)", maxPct:null, alergen:false, nota:""},
  {id:"ulei-migdale", ro:"Ulei de migdale dulci", inci:"Prunus Amygdalus Dulcis (Sweet Almond) Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient", maxPct:null, alergen:false, nota:"Alergen la persoane sensibile la fructe cu coajă"},
  {id:"ulei-floarea-soarelui", ro:"Ulei de floarea-soarelui", inci:"Helianthus Annuus (Sunflower) Seed Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient", maxPct:null, alergen:false, nota:""},
  {id:"ulei-jojoba", ro:"Ulei de jojoba", inci:"Simmondsia Chinensis (Jojoba) Seed Oil", cat:"Ulei vegetal (ceară lichidă)", faza:"ulei", functie:"Emolient, regenerant", maxPct:null, alergen:false, nota:""},
  {id:"ulei-argan", ro:"Ulei de argan", inci:"Argania Spinosa Kernel Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient, antioxidant", maxPct:null, alergen:false, nota:""},
  {id:"ulei-ricin", ro:"Ulei de ricin", inci:"Ricinus Communis (Castor) Seed Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient, agent spumant (săpun)", maxPct:null, alergen:false, nota:""},
  {id:"ulei-avocado", ro:"Ulei de avocado", inci:"Persea Gratissima (Avocado) Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient, nutritiv", maxPct:null, alergen:false, nota:""},
  {id:"ulei-masline-pomace", ro:"Ulei de măsline pomace", inci:"Olea Europaea (Olive) Pomace Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient (calitate inferioară, cost redus)", maxPct:null, alergen:false, nota:""},
  {id:"ulei-canepa", ro:"Ulei de cânepă", inci:"Cannabis Sativa Seed Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient, regenerant", maxPct:null, alergen:false, nota:""},
  {id:"ulei-rapita", ro:"Ulei de rapiță", inci:"Brassica Napus Seed Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient", maxPct:null, alergen:false, nota:""},
  {id:"ulei-susan", ro:"Ulei de susan", inci:"Sesamum Indicum (Sesame) Seed Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient", maxPct:null, alergen:false, nota:""},
  {id:"ulei-macadamia", ro:"Ulei de macadamia", inci:"Macadamia Ternifolia Seed Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Emolient", maxPct:null, alergen:false, nota:""},
  {id:"ulei-germeni-grau", ro:"Ulei din germeni de grâu", inci:"Triticum Vulgare (Wheat) Germ Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Antioxidant, emolient", maxPct:null, alergen:false, nota:"Conține gluten - de evitat produse pt. piele lezată"},
  {id:"ulei-catina", ro:"Ulei de cătină", inci:"Hippophae Rhamnoides Fruit Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Regenerant, colorant natural (portocaliu)", maxPct:null, alergen:false, nota:"Poate păta țesăturile"},
  {id:"ulei-rosehip", ro:"Ulei de măceșe", inci:"Rosa Canina Fruit Oil", cat:"Ulei vegetal", faza:"ulei", functie:"Regenerant, anti-aging", maxPct:null, alergen:false, nota:""},
  {id:"ulei-nuca-cocos-fractionat", ro:"Ulei de cocos fracționat", inci:"Caprylic/Capric Triglyceride", cat:"Ulei vegetal modificat", faza:"ulei", functie:"Emolient, solvent lichid", maxPct:null, alergen:false, nota:""},
  {id:"vitamina-e", ro:"Vitamina E (Tocoferol)", inci:"Tocopherol", cat:"Antioxidant", faza:"ulei", functie:"Antioxidant (previne râncezirea)", maxPct:null, alergen:false, nota:"Uzual 0.5-1% ca antioxidant"},

  // ===== UNTURI =====
  {id:"unt-shea", ro:"Unt de shea", inci:"Butyrospermum Parkii (Shea) Butter", cat:"Unt vegetal", faza:"ulei", functie:"Emolient bogat, ocluziv", maxPct:null, alergen:false, nota:""},
  {id:"unt-cacao", ro:"Unt de cacao", inci:"Theobroma Cacao (Cocoa) Seed Butter", cat:"Unt vegetal", faza:"ulei", functie:"Emolient, întăritor textură", maxPct:null, alergen:false, nota:""},
  {id:"unt-mango", ro:"Unt de mango", inci:"Mangifera Indica (Mango) Seed Butter", cat:"Unt vegetal", faza:"ulei", functie:"Emolient", maxPct:null, alergen:false, nota:""},
  {id:"unt-cupuacu", ro:"Unt de cupuaçu", inci:"Theobroma Grandiflorum Seed Butter", cat:"Unt vegetal", faza:"ulei", functie:"Emolient, hidratant", maxPct:null, alergen:false, nota:""},
  {id:"unt-illipe", ro:"Unt de illipe", inci:"Shorea Stenoptera Seed Butter", cat:"Unt vegetal", faza:"ulei", functie:"Întăritor textură (înlocuitor unt de cacao)", maxPct:null, alergen:false, nota:""},

  // ===== CERURI / EMULSIFIANȚI =====
  {id:"ceara-albine", ro:"Ceară de albine", inci:"Cera Alba", cat:"Ceară", faza:"ulei", functie:"Întăritor textură, ocluziv", maxPct:null, alergen:false, nota:""},
  {id:"ceara-candelilla", ro:"Ceară de candelilla", inci:"Euphorbia Cerifera (Candelilla) Wax", cat:"Ceară vegetală", faza:"ulei", functie:"Întăritor textură (alternativă vegană la ceara de albine)", maxPct:null, alergen:false, nota:""},
  {id:"ceara-carnauba", ro:"Ceară de carnauba", inci:"Copernicia Cerifera (Carnauba) Wax", cat:"Ceară vegetală", faza:"ulei", functie:"Întăritor textură, luciu (balsam de buze)", maxPct:null, alergen:false, nota:"Punct de topire ridicat - se folosește în cantitate mică"},
  {id:"emulsifying-wax-ne", ro:"Ceară emulsifiantă NE", inci:"Cetearyl Alcohol (and) Sodium Cetearyl Sulfate", cat:"Emulsifiant", faza:"ulei", functie:"Emulsifiant O/A pentru creme", maxPct:null, alergen:false, nota:"Verifică INCI exact de la furnizor - compoziția variază"},
  {id:"olivem-1000", ro:"Emulsifiant din măsline (Olivem 1000)", inci:"Cetearyl Olivate (and) Sorbitan Olivate", cat:"Emulsifiant natural", faza:"ulei", functie:"Emulsifiant O/A ecologic", maxPct:null, alergen:false, nota:"Uzual 3-6% din formulă"},
  {id:"lecitina", ro:"Lecitină de floarea-soarelui", inci:"Lecithin", cat:"Emulsifiant", faza:"ulei", functie:"Emulsifiant, co-emulsifiant", maxPct:null, alergen:false, nota:""},
  {id:"alcool-cetearilic", ro:"Alcool cetearilic", inci:"Cetearyl Alcohol", cat:"Co-emulsifiant / întăritor", faza:"ulei", functie:"Întăritor textură, stabilizator emulsie", maxPct:null, alergen:false, nota:"Nu este alcool etilic - nu usucă pielea"},

  // ===== GELIFIANȚI / TEXTURĂ (apă) =====
  {id:"xanthan-gum", ro:"Gumă xantan", inci:"Xanthan Gum", cat:"Gelifiant", faza:"apa", functie:"Îngroșător, stabilizator", maxPct:null, alergen:false, nota:"Uzual 0.2-1%"},
  {id:"aloe-vera-gel", ro:"Gel de Aloe vera", inci:"Aloe Barbadensis Leaf Juice", cat:"Extract / bază apoasă", faza:"apa", functie:"Hidratant, calmant", maxPct:null, alergen:false, nota:""},
  {id:"glicerina", ro:"Glicerină vegetală", inci:"Glycerin", cat:"Umectant", faza:"apa", functie:"Umectant (atrage apa în piele)", maxPct:null, alergen:false, nota:""},

  // ===== CONSERVANȚI (Anexa V) — restricții legale stricte =====
  {id:"phenoxyethanol", ro:"Fenoxietanol", inci:"Phenoxyethanol", cat:"Conservant", faza:"apa", functie:"Conservant cu spectru larg", maxPct:1.0, alergen:false, nota:"Anexa V/29 — max 1% în produsul finit"},
  {id:"acid-benzoic", ro:"Acid benzoic", inci:"Benzoic Acid", cat:"Conservant", faza:"apa", functie:"Conservant (antifungic)", maxPct:0.5, alergen:false, nota:"Anexa V/1 — max 0.5% (ca acid, calculat separat sau împreună cu sărurile sale)"},
  {id:"benzoat-sodiu", ro:"Benzoat de sodiu", inci:"Sodium Benzoate", cat:"Conservant", faza:"apa", functie:"Conservant", maxPct:0.5, alergen:false, nota:"Anexa V/1 — max 0.5% calculat ca acid benzoic"},
  {id:"acid-sorbic", ro:"Acid sorbic", inci:"Sorbic Acid", cat:"Conservant", faza:"apa", functie:"Conservant (antifungic)", maxPct:0.6, alergen:false, nota:"Anexa V/22 — max 0.6% (ca acid)"},
  {id:"sorbat-potasiu", ro:"Sorbat de potasiu", inci:"Potassium Sorbate", cat:"Conservant", faza:"apa", functie:"Conservant", maxPct:0.6, alergen:false, nota:"Anexa V/22 — max 0.6% calculat ca acid sorbic"},
  {id:"alcool-benzilic", ro:"Alcool benzilic", inci:"Benzyl Alcohol", cat:"Conservant", faza:"apa", functie:"Conservant, solvent, parfumant", maxPct:1.0, alergen:true, nota:"Anexa V/34 — max 1%; e și pe lista celor 82 alergeni de parfum (Anexa III, extinsă prin Reg. (UE) 2023/1545), etichetare obligatorie >0.001% leave-on"},
  {id:"acid-dehidroacetic", ro:"Acid dehidroacetic", inci:"Dehydroacetic Acid", cat:"Conservant", faza:"apa", functie:"Conservant", maxPct:0.6, alergen:false, nota:"Anexa V/12 — max 0.6% (ca acid)"},
  {id:"acid-salicilic", ro:"Acid salicilic", inci:"Salicylic Acid", cat:"Conservant / exfoliant (BHA)", faza:"apa", functie:"Conservant sau activ exfoliant", maxPct:0.5, alergen:false, nota:"Prag afișat (0.5%) e limita ca CONSERVANT (Anexa V). Ca activ exfoliant/BHA (Anexa III), limita legală e mai mare — max 2% în majoritatea produselor, 3% în produse de clătire pentru păr — dar INTERZIS complet în loțiune de corp, zona ochilor, ruj și deodorant roll-on, indiferent de concentrație. INTERZIS în orice produs pentru copii sub 3 ani (cu excepții specifice pt. șampon). Verifică încadrarea exactă pe tipul tău de produs înainte de a depăși 0.5%."},
  {id:"ecogard", ro:"Conservant natural (ex. Leucidal / Geogard)", inci:"variază după produs — verifică fișa tehnică a furnizorului", cat:"Conservant natural/derivat", faza:"apa", functie:"Conservant", maxPct:null, alergen:false, nota:"INCI-ul exact diferă complet de la un produs comercial la altul — nu presupune, verifică fișa tehnică"},

  // ===== ACTIVE / EXTRACTE =====
  {id:"niacinamida", ro:"Niacinamidă (Vitamina B3)", inci:"Niacinamide", cat:"Activ", faza:"apa", functie:"Calmant, uniformizant ten", maxPct:null, alergen:false, nota:"Uzual 2-5%"},
  {id:"acid-hialuronic", ro:"Acid hialuronic", inci:"Sodium Hyaluronate", cat:"Activ", faza:"apa", functie:"Umectant, hidratant profund", maxPct:null, alergen:false, nota:"Uzual 0.1-2%"},
  {id:"extract-galbenele", ro:"Extract de gălbenele", inci:"Calendula Officinalis Flower Extract", cat:"Extract vegetal", faza:"apa/ulei", functie:"Calmant, antiinflamator", maxPct:null, alergen:false, nota:""},
  {id:"extract-musetel", ro:"Extract de mușețel", inci:"Chamomilla Recutita (Matricaria) Flower Extract", cat:"Extract vegetal", faza:"apa/ulei", functie:"Calmant", maxPct:null, alergen:true, nota:"Poate conține urme de alergeni de parfum natural"},
  {id:"extract-ceai-verde", ro:"Extract de ceai verde", inci:"Camellia Sinensis Leaf Extract", cat:"Extract vegetal", faza:"apa", functie:"Antioxidant", maxPct:null, alergen:false, nota:""},
  {id:"argila-alba", ro:"Argilă albă (caolin)", inci:"Kaolin", cat:"Argilă", faza:"pulbere", functie:"Absorbant, mineralizant", maxPct:null, alergen:false, nota:""},
  {id:"argila-verde", ro:"Argilă verde", inci:"Montmorillonite", cat:"Argilă", faza:"pulbere", functie:"Absorbant sebum, detoxifiant", maxPct:null, alergen:false, nota:""},
  {id:"argila-roz", ro:"Argilă roz", inci:"Kaolin (and) Illite / Iron Oxides", cat:"Argilă", faza:"pulbere", functie:"Absorbant, colorant natural", maxPct:null, alergen:false, nota:"Compoziția exactă variază după furnizor"},
  {id:"bicarbonat-sodiu", ro:"Bicarbonat de sodiu", inci:"Sodium Bicarbonate", cat:"Ingredient tehnic", faza:"pulbere", functie:"Efervescent (bombe de baie), exfoliant", maxPct:null, alergen:false, nota:""},
  {id:"acid-citric", ro:"Acid citric", inci:"Citric Acid", cat:"Ajustare pH", faza:"apa", functie:"Ajustare pH, efervescent (cu bicarbonat)", maxPct:null, alergen:false, nota:"Nu are restricție de concentrație; folosit tipic sub 1% pt. ajustare pH"},
  {id:"mica", ro:"Mică (pigment sidefat)", inci:"Mica", cat:"Colorant", faza:"pulbere", functie:"Colorant, efect sidefat", maxPct:null, alergen:false, nota:"Poate fi combinată cu oxizi de fier (CI 77xxx) pt. culoare"},
  {id:"oxid-fier", ro:"Oxid de fier (colorant)", inci:"CI 77491 / CI 77492 / CI 77499 (Iron Oxides)", cat:"Colorant (Anexa IV)", faza:"pulbere", functie:"Colorant natural mineral", maxPct:null, alergen:false, nota:"Anexa IV — colorant admis, fără restricție specială de concentrație pt. aceste nuanțe"},
  {id:"dioxid-titan", ro:"Dioxid de titan", inci:"CI 77891 (Titanium Dioxide)", cat:"Colorant/opacifiant (Anexa IV)", faza:"pulbere", functie:"Albire, opacifiant, filtru UV fizic", maxPct:25, alergen:false, nota:"Ca filtru UV (nano) — Anexa VI, max 25%; ca și colorant simplu nu are limită separată"},

  // ===== INGREDIENTE SĂPUN (saponificare) =====
  {id:"hidroxid-sodiu", ro:"Hidroxid de sodiu (sodă caustică)", inci:"Sodium Hydroxide", cat:"Agent de saponificare", faza:"tehnic", functie:"Saponificare (săpun solid) — NU rămâne în produsul finit dacă rețeta e calculată corect", maxPct:null, alergen:false, nota:"Substanță corozivă — necesită echipament de protecție; nu apare pe eticheta produsului finit dacă superfatarea e corectă"},
  {id:"hidroxid-potasiu", ro:"Hidroxid de potasiu (potasă caustică)", inci:"Potassium Hydroxide", cat:"Agent de saponificare", faza:"tehnic", functie:"Saponificare (săpun lichid)", maxPct:null, alergen:false, nota:"Substanță corozivă — necesită echipament de protecție"},

  // ===== SURFACTANȚI (produse de curățare lichide) =====
  {id:"sles", ro:"Surfactant SLES (bază spumantă)", inci:"Sodium Laureth Sulfate", cat:"Surfactant", faza:"apa", functie:"Agent spumant/curățare", maxPct:null, alergen:false, nota:"Nu e considerat „natural” de majoritatea certificărilor eco"},
  {id:"cocamidopropyl-betaine", ro:"Cocamidopropyl betaine", inci:"Cocamidopropyl Betaine", cat:"Surfactant secundar", faza:"apa", functie:"Co-surfactant, reduce iritarea", maxPct:null, alergen:false, nota:"Poate conține urme de amidoamină — alergen de contact la unele persoane"},
  {id:"decyl-glucoside", ro:"Decyl glucoside", inci:"Decyl Glucoside", cat:"Surfactant blând", faza:"apa", functie:"Agent spumant din zahăr/porumb — blând, natural", maxPct:null, alergen:false, nota:"Popular în cosmetica naturală/eco"},

  // ===== ULEIURI ESENȚIALE (parfumare naturală) — conțin alergeni obligatoriu de declarat =====
  {id:"eo-lavanda", ro:"Ulei esențial de lavandă", inci:"Lavandula Angustifolia Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare, calmant", maxPct:null, alergen:true, nota:"Conține Linalool, Geraniol, Limonene — alergeni cu etichetare obligatorie dacă depășesc pragul (0.001% leave-on / 0.01% rinse-off)"},
  {id:"eo-lamaie", ro:"Ulei esențial de lămâie", inci:"Citrus Limon Peel Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare", maxPct:null, alergen:true, nota:"Conține Limonene, Citral — fotosensibilizant, alergeni de declarat; evită expunerea la soare după aplicare"},
  {id:"eo-portocale", ro:"Ulei esențial de portocale dulci", inci:"Citrus Sinensis Peel Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare", maxPct:null, alergen:true, nota:"Conține Limonene — fotosensibilizant ușor, alergen de declarat"},
  {id:"eo-mentha", ro:"Ulei esențial de mentă", inci:"Mentha Piperita (Peppermint) Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare, răcoritor", maxPct:5, alergen:true, nota:"Conține Limonene, Linalool; IFRA recomandă limite pe categorie de produs (uzual sub 5% în produse leave-on)"},
  {id:"eo-tea-tree", ro:"Ulei esențial de arbore de ceai (Tea Tree)", inci:"Melaleuca Alternifolia Leaf Oil", cat:"Ulei esențial", faza:"ulei", functie:"Antiseptic, parfumare", maxPct:null, alergen:true, nota:"Conține Limonene, Linalool — poate oxida și deveni mai iritant, se recomandă antioxidant + depozitare corectă"},
  {id:"eo-eucalipt", ro:"Ulei esențial de eucalipt", inci:"Eucalyptus Globulus Leaf Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare, decongestionant", maxPct:null, alergen:true, nota:"Conține Limonene — alergen de declarat; nu pt. copii mici (risc respirator)"},
  {id:"eo-rozmarin", ro:"Ulei esențial de rozmarin", inci:"Rosmarinus Officinalis Leaf Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare, stimulent circulator", maxPct:null, alergen:true, nota:"Conține Limonene, Linalool — evitat la persoane cu epilepsie/hipertensiune (uz intern/inhalare masivă)"},
  {id:"eo-ylang-ylang", ro:"Ulei esențial de ylang-ylang", inci:"Cananga Odorata Flower Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare", maxPct:0.8, alergen:true, nota:"Conține Benzyl Benzoate, Benzyl Salicylate, Farnesol, Geraniol, Linalool — alergeni multipli; IFRA impune limite stricte"},
  {id:"eo-ienupar", ro:"Ulei esențial de ienupăr", inci:"Juniperus Communis Fruit Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare", maxPct:null, alergen:true, nota:"Conține Limonene — de evitat în sarcină"},
  {id:"eo-brad", ro:"Ulei esențial de brad", inci:"Abies Sibirica Oil", cat:"Ulei esențial", faza:"ulei", functie:"Parfumare", maxPct:null, alergen:true, nota:"Conține Limonene — alergen de declarat"},

  // ===== PARFUMANȚI / ADITIVI =====
  {id:"fragrance-oil", ro:"Ulei parfumat (fragrance oil, sintetic/natural-identic)", inci:"Parfum (Fragrance)", cat:"Parfumant", faza:"ulei", functie:"Parfumare", maxPct:null, alergen:true, nota:"Necesită fișa IFRA de la furnizor — lista de alergeni conținuți trebuie verificată produs cu produs"},
  {id:"apa-distilata", ro:"Apă distilată/demineralizată", inci:"Aqua (Water)", cat:"Bază apoasă", faza:"apa", functie:"Solvent, bază formulă", maxPct:null, alergen:false, nota:""},
];

// Praguri de etichetare obligatorie pentru cei 26(+3) alergeni de parfum recunoscuți UE (Anexa III, actualizare 2023)
const ALERGEN_THRESHOLD_LEAVE_ON = 0.001; // % - produse care rămân pe piele
const ALERGEN_THRESHOLD_RINSE_OFF = 0.01; // % - produse clătite

// Valori de saponificare (SAP) — grame de NaOH necesare pentru a saponifica complet 1g din uleiul/untul respectiv.
// Valori de referință general acceptate în calculatoarele de leșie pentru săpun cold-process — variază ușor
// de la un lot la altul; pentru precizie maximă, verifică fișa tehnică a furnizorului tău.
const SAP_NAOH = {
  "ulei-masline": 0.134,
  "ulei-masline-pomace": 0.134,
  "ulei-cocos": 0.183,
  "ulei-migdale": 0.136,
  "ulei-floarea-soarelui": 0.134,
  "ulei-jojoba": 0.069,
  "ulei-argan": 0.135,
  "ulei-ricin": 0.1286,
  "ulei-avocado": 0.133,
  "ulei-canepa": 0.1345,
  "ulei-rapita": 0.1245,
  "ulei-susan": 0.133,
  "ulei-macadamia": 0.139,
  "ulei-germeni-grau": 0.131,
  "ulei-rosehip": 0.1378,
  "unt-shea": 0.128,
  "unt-cacao": 0.137,
  "unt-mango": 0.137,
  "unt-cupuacu": 0.128,
  "unt-illipe": 0.1385,
};
// Factor de conversie NaOH → KOH pentru săpun lichid (valoare SAP KOH = valoare SAP NaOH × 1.403)
const SAP_KOH_FACTOR = 1.403;

if (typeof module !== "undefined") { module.exports = { INGREDIENTS, ALERGEN_THRESHOLD_LEAVE_ON, ALERGEN_THRESHOLD_RINSE_OFF, SAP_NAOH, SAP_KOH_FACTOR }; }
