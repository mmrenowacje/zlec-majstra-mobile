type Coordinates = {
  latitude: number;
  longitude: number;
};

const SERVICE_RADIUS_KM = 50;

// City centres keep the filter deterministic and avoid sending customer
// addresses to a third-party geocoding service.
const polishLocalityCoordinates: Record<string, Coordinates> = {
  bialystok: { latitude: 53.1325, longitude: 23.1688 },
  bydgoszcz: { latitude: 53.1235, longitude: 18.0084 },
  czestochowa: { latitude: 50.8118, longitude: 19.1203 },
  gdansk: { latitude: 54.352, longitude: 18.6466 },
  gdynia: { latitude: 54.5189, longitude: 18.5305 },
  gliwice: { latitude: 50.2945, longitude: 18.6714 },
  "gorzow-wielkopolski": { latitude: 52.7325, longitude: 15.2369 },
  grudziadz: { latitude: 53.4837, longitude: 18.7536 },
  kalisz: { latitude: 51.7611, longitude: 18.091 },
  katowice: { latitude: 50.2649, longitude: 19.0238 },
  kielce: { latitude: 50.8661, longitude: 20.6286 },
  koszalin: { latitude: 54.1944, longitude: 16.1722 },
  krakow: { latitude: 50.0647, longitude: 19.945 },
  legnica: { latitude: 51.207, longitude: 16.1553 },
  lublin: { latitude: 51.2465, longitude: 22.5684 },
  lodz: { latitude: 51.7592, longitude: 19.456 },
  olsztyn: { latitude: 53.7784, longitude: 20.4801 },
  opole: { latitude: 50.6751, longitude: 17.9213 },
  poznan: { latitude: 52.4064, longitude: 16.9252 },
  pruszkow: { latitude: 52.1707, longitude: 20.8121 },
  plock: { latitude: 52.5463, longitude: 19.7065 },
  radom: { latitude: 51.4027, longitude: 21.1471 },
  rzeszow: { latitude: 50.0412, longitude: 21.9991 },
  sosnowiec: { latitude: 50.2863, longitude: 19.1041 },
  szczecin: { latitude: 53.4285, longitude: 14.5528 },
  tarnow: { latitude: 50.0121, longitude: 20.9858 },
  torun: { latitude: 53.0138, longitude: 18.5984 },
  tychy: { latitude: 50.1372, longitude: 18.9664 },
  walbrzych: { latitude: 50.7714, longitude: 16.2843 },
  warszawa: { latitude: 52.2297, longitude: 21.0122 },
  wloclawek: { latitude: 52.6482, longitude: 19.0678 },
  wroclaw: { latitude: 51.1079, longitude: 17.0385 },
  zabrze: { latitude: 50.3249, longitude: 18.7857 },
  "zielona-gora": { latitude: 51.9356, longitude: 15.5062 },
};

function normalizeLocality(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/\b\d{2}[-\s]?\d{3}\b/g, " ")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[;,]/, 1)[0]
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-");
}

function coordinatesFor(value: string): Coordinates | null {
  return polishLocalityCoordinates[normalizeLocality(value)] ?? null;
}

function distanceInKm(first: Coordinates, second: Coordinates): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = ((second.latitude - first.latitude) * Math.PI) / 180;
  const longitudeDelta = ((second.longitude - first.longitude) * Math.PI) / 180;
  const firstLatitude = (first.latitude * Math.PI) / 180;
  const secondLatitude = (second.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

export function isWithinContractorServiceArea(
  requestLocation: string,
  contractorLocation: string,
): boolean {
  const normalizedRequestLocation = normalizeLocality(requestLocation);
  const normalizedContractorLocation = normalizeLocality(contractorLocation);

  if (
    normalizedRequestLocation.length === 0 ||
    normalizedContractorLocation.length === 0
  ) {
    return false;
  }
  if (normalizedRequestLocation === normalizedContractorLocation) {
    return true;
  }

  const requestCoordinates = coordinatesFor(requestLocation);
  const contractorCoordinates = coordinatesFor(contractorLocation);
  return Boolean(
    requestCoordinates &&
      contractorCoordinates &&
      distanceInKm(requestCoordinates, contractorCoordinates) <= SERVICE_RADIUS_KM,
  );
}