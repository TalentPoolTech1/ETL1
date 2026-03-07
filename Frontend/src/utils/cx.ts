// Simple classnames implementation
export function cx(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string {
  const result: string[] = [];
  
  for (const cls of classes) {
    if (typeof cls === 'string') {
      result.push(cls);
    } else if (typeof cls === 'object' && cls !== null && !Array.isArray(cls)) {
      for (const [key, value] of Object.entries(cls)) {
        if (value) result.push(key);
      }
    }
  }
  
  return result.join(' ');
}
