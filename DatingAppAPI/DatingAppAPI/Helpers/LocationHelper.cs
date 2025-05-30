using System;

namespace DatingAppAPI.Helpers
{
    public static class LocationHelper
    {
        private const double EarthRadiusKm = 6371; // Bán kính trái đất km

        public static double CalculateDistance(double startLatitude, double startLongitude, double endLatitude, double endLongitude)
        {
            var dLat = ToRadians(endLatitude - startLatitude);
            var dLon = ToRadians(endLongitude - startLongitude);

            var lat1Rad = ToRadians(startLatitude);
            var lat2Rad = ToRadians(endLatitude);

            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2) * Math.Cos(lat1Rad) * Math.Cos(lat2Rad);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return EarthRadiusKm * c;
        }

        private static double ToRadians(double angleInDegrees)
        {
            return angleInDegrees * Math.PI / 180.0;
        }
    }
}