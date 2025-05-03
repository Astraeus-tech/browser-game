import type { Event } from '$lib/types';

// Eagerly import all JSON files under this folder (one per quarter or event)
const modules = import.meta.glob<Event>('./**/*.json', { eager: true });

// Flatten the imported modules into a single array of events
const events: Event[] = Object.values(modules).flat();

export default events; 