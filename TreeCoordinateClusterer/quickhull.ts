export type Point = { x: number; y: number };

export function quickHull2(points: Point[]): Point[] {
    if (points.length < 3) return points;

    const getSide = (a: Point, b: Point, p: Point): number =>
        (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

    const distance = (a: Point, b: Point, p: Point): number =>
        Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y));

    const findHull = (set: Point[], a: Point, b: Point, side: number, hull: Point[]) => {
        let index = -1;
        let maxDist = 0;

        for (let i = 0; i < set.length; i++) {
            const temp = distance(a, b, set[i]);
            if (getSide(a, b, set[i]) === side && temp > maxDist) {
                index = i;
                maxDist = temp;
            }
        }

        if (index === -1) {
            hull.push(b);
            return;
        }

        findHull(set, a, set[index], -getSide(a, set[index], b), hull);
        findHull(set, set[index], b, -getSide(set[index], b, a), hull);
    };

    const minPoint = points.reduce((min, p) => (p.x < min.x ? p : min), points[0]);
    const maxPoint = points.reduce((max, p) => (p.x > max.x ? p : max), points[0]);

    const leftSet = points.filter(p => getSide(minPoint, maxPoint, p) > 0);
    const rightSet = points.filter(p => getSide(minPoint, maxPoint, p) < 0);

    const hull: Point[] = [minPoint];
    findHull(leftSet, minPoint, maxPoint, 1, hull);
    findHull(rightSet, maxPoint, minPoint, 1, hull);

    return hull;
}

// https://www.geeksforgeeks.org/dsa/quickhull-algorithm-convex-hull/
// JavaScript program to implement Quick Hull algorithm
// to find convex hull.

// Returns the side of point p with respect to line
// joining points p1 and p2.
function findSide(p1, p2, p)
{
    let val = (p[1] - p1[1]) * (p2[0] - p1[0]) -
            (p2[1] - p1[1]) * (p[0] - p1[0]);

    if (val > 0)
        return 1;
    if (val < 0)
        return -1;
    return 0;
}

// returns a value proportional to the distance
// between the point p and the line joining the
// points p1 and p2
function lineDist(p1, p2, p)
{
    return Math.abs ((p[1] - p1[1]) * (p2[0] - p1[0]) -
            (p2[1] - p1[1]) * (p[0] - p1[0]));
}

// End points of line L are p1 and p2. side can have value
// 1 or -1 specifying each of the parts made by the line L
function quickHull(hull, a, n, p1, p2, side)
{
    let ind = -1;
    let max_dist = 0;

    // finding the point with maximum distance
    // from L and also on the specified side of L.
    for (let i=0; i<n; i++)
    {
        let temp = lineDist(p1, p2, a[i]);
        if ((findSide(p1, p2, a[i]) == side) && (temp > max_dist))
        {
            ind = i;
            max_dist = temp;
        }
    }

    // If no point is found, add the end points
    // of L to the convex hull.
    if (ind == -1)
    {
        hull.add(p1);
        hull.add(p2);
        return;
    }

    // Recur for the two parts divided by a[ind]
    quickHull(hull, a, n, a[ind], p1, -findSide(a[ind], p1, p2));
    quickHull(hull, a, n, a[ind], p2, -findSide(a[ind], p2, p1));
}

export function quickHull3(points: number[][]): number[][]
{   const n = points.length;

    // Stores the result (points of convex hull)
    let hull = new Set<number[]>();

    // a[i].second -> y-coordinate of the ith point
    if (n < 3)
    {
        console.log("Convex hull not possible");
        return new Array<number[]>;
    }

    // Finding the point with minimum and
    // maximum x-coordinate
    let min_x = 0, max_x = 0;
    for (let i=1; i<n; i++)
    {
        if (points[i][0] < points[min_x][0])
            min_x = i;
        if (points[i][0] > points[max_x][0])
            max_x = i;
    }

    // Recursively find convex hull points on
    // one side of line joining a[min_x] and
    // a[max_x]
    quickHull(hull, points, n, points[min_x], points[max_x], 1);

    // Recursively find convex hull points on
    // other side of line joining a[min_x] and
    // a[max_x]
    quickHull(hull, points, n, points[min_x], points[max_x], -1);

    // console.log("The points in Convex Hull are:");
    
    // hull.forEach(element =>{
    //     console.log("(", element[0], ", ", element[1], ") ");
    // })
    return Array.from(hull.values());
}