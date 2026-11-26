/* Estado global em memória sincronizado com a API / Supabase. Carregar primeiro. */
let authToken = null;
let currentUser = null;

let animalsData = [];
let collectionsData = [];
let appointmentsData = [];
let clinicsData = [];
let clinicContacts = [];
let homeStats = {
    animals: 0,
    clinics: 0,
    appointments: 0,
    collections: 0,
    partnerNames: []
};

const DEFAULT_PET_PHOTO = 'assets/pet-placeholder.svg';

function petPhoto(animal) {
    const p = animal && animal.photo;
    if (!p || p.includes('images.unsplash.com/photo-1543466835')) return DEFAULT_PET_PHOTO;
    return safeUrl(p, DEFAULT_PET_PHOTO);
}