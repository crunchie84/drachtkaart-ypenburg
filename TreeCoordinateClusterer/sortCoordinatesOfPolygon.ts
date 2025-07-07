// code from https://stackoverflow.com/a/2859695/106909
// given a list of [x,y] order these to create a circulair outline
export function sorted_points(points: Array<{x: number, y: number}>): Array<{x: number, y: number}> {
    points = points.slice(0); // copy the array, since sort() modifies it
    const stringify_point = function(p) { return p.x + ',' + p.y; };

    // finds a point in the interior of `pts`
    const avg_points = function(pts) {
        let x = 0;
        let y = 0;
        for (let i = 0; i < pts.length; i++) {
            x += pts[i].x;
            y += pts[i].y;
        }
        return {x: x/pts.length, y:y/pts.length};
    }
    const center = avg_points(points);

    // calculate the angle between each point and the centerpoint, and sort by those angles
    const angles = {};
    for(let i = 0; i < points.length; i++) {
        angles[stringify_point(points[i])] = Math.atan2(points[i].x - center.x, points[i].y - center.y);
    }
    points.sort(function(p1, p2) {
        return angles[stringify_point(p1)] - angles[stringify_point(p2)];
    });
    return points;
}