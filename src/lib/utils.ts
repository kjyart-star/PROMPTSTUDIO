export interface PlaylistDescriptionInfo {
  type: 'album' | 'playlist';
  text: string;
}

export function parsePlaylistDescription(description: string | null | undefined): PlaylistDescriptionInfo {
  if (!description) {
    return { type: 'album', text: '' };
  }
  
  if (description.startsWith('[album]')) {
    return { type: 'album', text: description.slice(7) };
  }
  
  if (description.startsWith('[playlist]')) {
    return { type: 'playlist', text: description.slice(10) };
  }
  
  // Default to album for any legacy records
  return { type: 'album', text: description };
}

export function serializePlaylistDescription(type: 'album' | 'playlist', text: string): string {
  const prefix = type === 'album' ? '[album]' : '[playlist]';
  return `${prefix}${text || ''}`;
}
