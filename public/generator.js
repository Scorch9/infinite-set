import {generate} from './engine.mjs';
self.onmessage = ({data}) => {
  try { self.postMessage(generate(data)); }
  catch (error) { self.postMessage({error: error.message}); }
};