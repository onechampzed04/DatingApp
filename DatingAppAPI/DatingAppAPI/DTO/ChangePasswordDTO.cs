// Trong thư mục DTOs (ví dụ: DTOs/ChangePasswordDto.cs)
using System.ComponentModel.DataAnnotations;

namespace DatingAppAPI.DTO
{
    public class ChangePasswordDTO
    {
        [Required]
        public string OldPassword { get; set; }

        [Required]
        [MinLength(6, ErrorMessage = "New password must be at least 6 characters long.")]
        public string NewPassword { get; set; }

        // Nếu bạn muốn xác nhận mật khẩu mới
        // [Compare("NewPassword", ErrorMessage = "The new password and confirmation password do not match.")]
        // public string ConfirmNewPassword { get; set; }
    }
}