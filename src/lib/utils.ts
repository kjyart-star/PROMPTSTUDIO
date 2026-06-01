export interface PlaylistDescriptionInfo {
  type: 'album' | 'playlist' | 'folder';
  text: string;
  parentId?: string | null;
  channelId?: string | null;
}

export function parsePlaylistDescription(description: string | null | undefined): PlaylistDescriptionInfo {
  if (!description) {
    return { type: 'album', text: '' };
  }
  
  if (description.startsWith('[album]')) {
    const raw = description.slice(7);
    try {
      if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
        const parsed = JSON.parse(raw);
        return { type: 'album', text: parsed.text || '', parentId: parsed.parent_id || null, channelId: parsed.channel_id || null };
      }
    } catch (e) {
      // ignore JSON parse error
    }
    return { type: 'album', text: raw, channelId: null };
  }
  
  if (description.startsWith('[playlist]')) {
    const raw = description.slice(10);
    try {
      if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
        const parsed = JSON.parse(raw);
        return { type: 'playlist', text: parsed.text || '', parentId: parsed.parent_id || null, channelId: parsed.channel_id || null };
      }
    } catch (e) {
      // ignore JSON parse error
    }
    return { type: 'playlist', text: raw, parentId: null, channelId: null };
  }
  
  if (description.startsWith('[folder]')) {
    const raw = description.slice(8);
    try {
      if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
        const parsed = JSON.parse(raw);
        return { type: 'folder', text: parsed.text || '', parentId: parsed.parent_id || null, channelId: parsed.channel_id || null };
      }
    } catch (e) {
      // ignore JSON parse error
    }
    return { type: 'folder', text: raw, parentId: null, channelId: null };
  }
  
  // Default to album for any legacy records
  return { type: 'album', text: description, channelId: null };
}

export function serializePlaylistDescription(type: 'album' | 'playlist' | 'folder', text: string, parentId?: string | null, channelId?: string | null): string {
  if (type === 'album') {
    if (channelId) return `[album]${JSON.stringify({ text: text || '', channel_id: channelId })}`;
    return `[album]${text || ''}`;
  }
  if (type === 'folder') {
    if (parentId || channelId) return `[folder]${JSON.stringify({ text: text || '', parent_id: parentId, channel_id: channelId })}`;
    return `[folder]${text || ''}`;
  }
  if (parentId || channelId) {
    return `[playlist]${JSON.stringify({ text: text || '', parent_id: parentId, channel_id: channelId })}`;
  } else {
    // Avoid stringifying just text to keep backwards compatibility if no parentId
    return `[playlist]${text || ''}`;
  }
}
