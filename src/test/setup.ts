import '@testing-library/jest-dom/vitest';

// jsdom has no scrolling layout; production browsers provide this API.
if(typeof HTMLElement!=='undefined'&&!HTMLElement.prototype.scrollIntoView)HTMLElement.prototype.scrollIntoView=()=>{};
