/**
 * Convert RD (Rijksdriehoek) coordinates to WGS84 and vice versa.
 * @see https://thomasv.nl/2014/03/rd-naar-gps/
 */
const projectionBetweenRdWgs84 = () => {
    const x0 = 155000;
    const y0 = 463000;
    const f0 = 52.15517440; // f => phi
    const l0 = 5.38720621;  // l => lambda
  
    const Kp = [0, 2, 0, 2, 0, 2, 1, 4, 2, 4, 1];
    const Kq = [1, 0, 2, 1, 3, 2, 0, 0, 3, 1, 1];
    const Kpq = [
      3235.65389,
      -32.58297,
      -0.2475,
      -0.84978,
      -0.0655,
      -0.01709,
      -0.00738,
      0.0053,
      -0.00039,
      0.00033,
      -0.00012,
    ];
  
    const Lp = [1, 1, 1, 3, 1, 3, 0, 3, 1, 0, 2, 5];
    const Lq = [0, 1, 2, 0, 3, 1, 1, 2, 4, 2, 0, 0];
    const Lpq = [
      5260.52916,
      105.94684,
      2.45656,
      -0.81885,
      0.05594,
      -0.05607,
      0.01199,
      -0.00256,
      0.00128,
      0.00022,
      -0.00022,
      0.00026,
    ];
  
    const Rp = [0, 1, 2, 0, 1, 3, 1, 0, 2];
    const Rq = [1, 1, 1, 3, 0, 1, 3, 2, 3];
    const Rpq = [190094.945, -11832.228, -114.221, -32.391, -0.705, -2.34, -0.608, -0.008, 0.148];
  
    const Sp = [1, 0, 2, 1, 3, 0, 2, 1, 0, 1];
    const Sq = [0, 2, 0, 2, 0, 1, 2, 1, 4, 4];
    const Spq = [309056.544, 3638.893, 73.077, -157.984, 59.788, 0.433, -6.439, -0.032, 0.092, -0.054];
  
    return {
      /**
       * Convert RD x, y to WGS84 lat, lon.
       */
      rdToWgs84: (x: number | { x: number, y: number } | number[], y = 0) => {
        if (x instanceof Array) {
          y = x[1];
          x = x[0];
        } else if (typeof x !== 'number') {
          y = x.y;
          x = x.x;
        }
        const dX = 1e-5 * (x - x0);
        const dY = 1e-5 * (y - y0);
  
        let lat = 0;
        let lon = 0;
  
        for (let i = 0; i < 10; i++) {
          lat = lat + Kpq[i] * dX ** Kp[i] * dY ** Kq[i];
        }
        lat = f0 + lat / 3600;
  
        for (let i = 0; i < 11; i++) {
          lon = lon + Lpq[i] * dX ** Lp[i] * dY ** Lq[i];
        }
        lon = l0 + lon / 3600;
  
        return { lat, lon };
      },
  
      /**
       * Convert WGS84 lat, lon (or [lat, lon]) to RD x, y.
       */
      wgs84ToRd: (lat: number | number[], lon = 0) => {
        if (lat instanceof Array) {
          lon = lat[1];
          lat = lat[0];
        }
        const df = 0.36 * (lat - f0);
        const dl = 0.36 * (lon - l0);
        let x = x0;
        let y = y0;
  
        for (let i = 0; i < 8; i++) {
          x = x + Rpq[i] * df ** Rp[i] * dl ** Rq[i];
        }
  
        for (let i = 0; i < 9; i++) {
          y = y + Spq[i] * df ** Sp[i] * dl ** Sq[i];
        }
        return { x, y };
      },
    };
  };
  
  export const projectRdWgs84 = projectionBetweenRdWgs84();
  
  /* TEST
   * const rotterdamRd = [91819, 437802];
   * const rotterdamWgs84 = project.rdToWgs84(rotterdamRd);
   * const rotterdamBack = project.wgs84ToRd(rotterdamWgs84.lat, rotterdamWgs84.lon);
   * 
   * console.log(`Rotterdam ${rotterdamRd[0]}, ${rotterdamRd[1]}`);
   * console.log(`Rotterdam ${rotterdamWgs84.lat}, ${rotterdamWgs84.lon}`);
   * console.log(`Rotterdam ${rotterdamBack.x}, ${rotterdamBack.y}`);
   */