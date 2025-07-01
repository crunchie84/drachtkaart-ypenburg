// code owner = https://github.com/arjendeblok/rd2wgs84/tree/main

export interface rds {
    x: number;
    y: number;
}

export interface wgs84 {
    lat: number;
    lon: number;
}

export function rd2WGS84(rd: rds): wgs84 {
    const dx = (rd.x - 155000)*1e-5;
    const dy = (rd.y - 463000)*1e-5;

    const lat = (
        52.15517440 + ((
        (3235.65389 * dy) + 
        ( -32.58297 * Math.pow(dx, 2)) + 
        ( -0.2475   * Math.pow(dy, 2)) + 
        ( -0.84978  * Math.pow(dx, 2) * dy) + 
        ( -0.0655   * Math.pow(dy, 3)) +
        ( -0.01709  * Math.pow(dx, 2) * Math.pow(dy, 2)) + 
        ( -0.00738  * dx) + 
        (  0.0053   * Math.pow(dx, 4)) + 
        ( -0.00039  * Math.pow(dx, 2) * Math.pow(dy, 3)) + 
        (  0.00033  * Math.pow(dx, 4) * dy) + 
        ( -0.00012  * dx * dy)
        ) 
        / 3600)
    );

    const lon = (
        5.38720621 + ((
        (5260.52916 * dx) + 
        ( 105.94684 * dx * dy) + 
        (   2.45656 * dx * Math.pow(dy,2)) + 
        (  -0.81885 * Math.pow(dx,3)) +
        (   0.05594 * dx * Math.pow(dy,3)) + 
        (  -0.05607 * Math.pow(dx,3) * dy) +
        (   0.01199 * dy) + 
        (  -0.00256 * Math.pow(dx,3) * Math.pow(dy, 2)) + 
        (   0.00128 * dx * Math.pow(dy, 4)) + 
        (   0.00022 * Math.pow(dy, 2)) + 
        (  -0.00022 * Math.pow(dx, 2)) + 
        (   0.00026 * Math.pow(dx, 5))
        ) / 3600)
    );

    return { lat, lon };
  };