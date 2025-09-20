declare module '*.md?raw' {
  const content: string;
  export default content;
}

// Also support regular markdown imports without ?raw
declare module '*.md' {
  const content: string;
  export default content;
}
