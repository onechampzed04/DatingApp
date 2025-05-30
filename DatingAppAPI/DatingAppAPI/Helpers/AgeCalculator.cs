﻿// Ví dụ: Helpers/AgeCalculator.cs
using System;

namespace DatingAppAPI.Helpers
{
    public static class AgeCalculator
    {
        public static int? CalculateAge(DateTimeOffset? birthdate)
        {
            if (!birthdate.HasValue)
            {
                return null;
            }

            var today = DateTimeOffset.UtcNow.Date; // Sử dụng DateTimeOffset
            var age = today.Year - birthdate.Value.Year;

            // Kiểm tra xem đã qua ngày sinh nhật năm nay chưa
            if (birthdate.Value.Date > today.AddYears(-age))
            {
                age--;
            }
            return age < 0 ? (int?)null : age; // Tránh tuổi âm nếu ngày sinh trong tương lai
        }
    }
}