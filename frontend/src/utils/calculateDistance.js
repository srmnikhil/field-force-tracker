export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg) => deg * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const meters = R * c;

    // round to 2 decimal places
    return Math.round(meters * 100) / 100;
}

export function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        const km = meters / 1000;
        return `${km.toFixed(2)} km`;
    }
}
