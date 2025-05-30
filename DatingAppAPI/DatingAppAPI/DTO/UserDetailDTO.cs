// File: DTO/UserDetailDTO.cs
using System;
using System.Collections.Generic;

namespace DatingAppAPI.DTO
{

    public class UserDetailDTO
    {
        public int UserID { get; set; }
        public string? Username { get; set; }
        public string? FullName { get; set; }
        public string? Gender { get; set; }
        public int? Age { get; set; } // Được tính toán từ Birthdate
        public DateTimeOffset? Birthdate { get; set; } // Có thể trả về ngày sinh nếu client muốn tự tính tuổi hoặc cung hoàng đạo
        public string? Bio { get; set; }
        public string? Avatar { get; set; } // URL của ảnh đại diện chính

        // Thông tin vị trí (nếu có và muốn hiển thị)
        public string? Address { get; set; } // Ví dụ: "Hanoi, Vietnam" (có thể được tạo từ Lat/Lon)
        public double? DistanceKm { get; set; } // Khoảng cách từ người dùng hiện tại (nếu tính được)

        // Thông tin liên hệ (cân nhắc kỹ về quyền riêng tư)
        // public string? PhoneNumber { get; set; } // Chỉ hiển thị nếu user cho phép hoặc cho admin
        // public string? Email { get; set; }       // Chỉ hiển thị nếu user cho phép hoặc cho admin

        // Trạng thái
        public string AccountStatus { get; set; } // Ví dụ: "Online", "Offline", "Active recently"
        public DateTimeOffset? LastLoginDate { get; set; } // Thời gian đăng nhập cuối

        // Sở thích
        public List<InterestDTO> Interests { get; set; } = new List<InterestDTO>();

        // Số lượng sở thích chung với người dùng đang xem (sẽ được tính ở backend)
        public int CommonInterestsCount { get; set; }

        public DateTimeOffset CreatedAt { get; set; } // Ngày tạo tài khoản

        // Các thông tin khác mà bạn muốn hiển thị trên trang cá nhân
        // Ví dụ: học vấn, công việc, chiều cao, thói quen (hút thuốc, uống rượu), etc.
        // public string? Education { get; set; }
        // public string? Work { get; set; }
    }
}