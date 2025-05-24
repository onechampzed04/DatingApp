using System.ComponentModel.DataAnnotations;

namespace DatingAppAPI.DTO
{
    public class SwipeCreateDTO
    {
        [Required]
        public int ToUserID { get; set; }

        [Required]
        public bool IsLike { get; set; }
    }
}