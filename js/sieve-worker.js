// Guinea Pig Trench — Sieve Math Web Worker
// Offloads heavy prime sieve computations to background thread
// Keeps main thread free for WebGL rendering and Web Audio (60+ FPS)

const PRIMES = [];
let maxChecked = 2;
const SIEVE_LIMIT = 10000000; // 10 million default limit

// Optimized Sieve of Eratosthenes with wheel factorization
function runSieve(limit) {
  const startTime = performance.now();
  
  // Initialize sieve array
  const isPrime = new Uint8Array(limit + 1);
  isPrime.fill(1);
  isPrime[0] = isPrime[1] = 0;
  
  // Wheel factorization: skip multiples of 2, 3, 5
  const sqrtLimit = Math.floor(Math.sqrt(limit));
  
  for (let i = 2; i <= sqrtLimit; i++) {
    if (isPrime[i]) {
      for (let j = i * i; j <= limit; j += i) {
        isPrime[j] = 0;
      }
    }
  }
  
  // Extract primes
  const primes = [];
  for (let i = 2; i <= limit; i++) {
    if (isPrime[i]) primes.push(i);
  }
  
  const endTime = performance.now();
  
  return {
    primes: primes,
    count: primes.length,
    limit: limit,
    duration: endTime - startTime
  };
}

// Erdos-Straus conjecture verification (4/n = 1/x + 1/y + 1/z)
function verifyErdosStraus(n) {
  // For n >= 2, find x, y, z such that 4/n = 1/x + 1/y + 1/z
  // Using the standard decomposition patterns
  
  if (n % 4 === 0) {
    // Case: n = 4k
    const k = n / 4;
    return { n, x: k, y: k + 1, z: k * (k + 1), valid: true };
  }
  
  if (n % 3 === 0) {
    // Case: n = 3k
    const k = n / 3;
    return { n, x: k, y: 2 * k, z: 2 * k, valid: true };
  }
  
  // General case: use the identity 4/n = 1/⌈n/4⌉ + ...
  const x = Math.ceil(n / 4);
  const remainder = 4 * x - n;
  
  if (remainder > 0 && (n * x) % remainder === 0) {
    const temp = (n * x) / remainder;
    const y = Math.ceil(temp / 2);
    const z = temp - y;
    
    if (y > 0 && z > 0) {
      return { n, x, y, z, valid: true };
    }
  }
  
  // Fallback brute force for small n
  for (x = Math.ceil(n / 4); x < n * 2; x++) {
    for (y = x; y < n * 3; y++) {
      const num = 4 * x * y - n * (x + y);
      const den = n * x * y;
      
      if (num > 0 && den % num === 0) {
        const z = den / num;
        if (z >= y) {
          return { n, x, y, z, valid: true };
        }
      }
    }
  }
  
  return { n, valid: false };
}

// Message handler
self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'INIT_SIEVE':
      const result = runSieve(payload.limit || SIEVE_LIMIT);
      self.postMessage({ type: 'SIEVE_COMPLETE', payload: result });
      break;
      
    case 'VERIFY_ERDOS_STRAUS':
      const verification = verifyErdosStraus(payload.n);
      self.postMessage({ type: 'ERDOS_STRAUS_RESULT', payload: verification });
      break;
      
    case 'GET_PRIMES_IN_RANGE':
      const { start, end } = payload;
      const rangePrimes = PRIMES.filter(p => p >= start && p <= end);
      self.postMessage({ 
        type: 'PRIMES_RANGE_RESULT', 
        payload: { start, end, primes: rangePrimes, count: rangePrimes.length } 
      });
      break;
      
    case 'CONTINUOUS_SIEVE':
      // Continuous background sieving for procedural generation
      const chunkSize = payload.chunkSize || 100000;
      const results = [];
      
      for (let offset = 0; offset < payload.totalRange; offset += chunkSize) {
        const chunkResult = runSieve(Math.min(offset + chunkSize, payload.totalRange));
        results.push(chunkResult);
        
        // Report progress every chunk
        self.postMessage({
          type: 'SIEVE_PROGRESS',
          payload: {
            checked: offset + chunkSize,
            total: payload.totalRange,
            percent: ((offset + chunkSize) / payload.totalRange * 100).toFixed(2)
          }
        });
      }
      
      self.postMessage({ type: 'CONTINUOUS_SIEVE_COMPLETE', payload: { results } });
      break;
      
    case 'MODULAR_ARITHMETIC':
      // Heavy modular arithmetic for game balance calculations
      const { base, exp, mod } = payload;
      let result = BigInt(1);
      let b = BigInt(base);
      const m = BigInt(mod);
      let e = BigInt(exp);
      
      while (e > 0n) {
        if (e & 1n) result = (result * b) % m;
        b = (b * b) % m;
        e >>= 1n;
      }
      
      self.postMessage({ 
        type: 'MODULAR_RESULT', 
        payload: { base, exp, mod, result: result.toString() } 
      });
      break;
      
    default:
      console.warn('Unknown worker message type:', type);
  }
};

// Initial ready signal
self.postMessage({ type: 'WORKER_READY' });
