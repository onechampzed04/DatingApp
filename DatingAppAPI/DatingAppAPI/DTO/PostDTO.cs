using DatingAppAPI.Models; // For ReactionType
using System;
using System.Collections.Generic;

namespace DatingAppAPI.DTO
{
    // DTO cho User cơ bản hiển thị trong Post/Comment
    public class PostUserDTO
    {
        public int UserID { get; set; }
        public string Username { get; set; }
        public string? FullName { get; set; }
        public string? Avatar { get; set; }
    }

    public class PostReactionDTO
    {
        public int PostReactionID { get; set; }
        public int UserID { get; set; }
        public string Username { get; set; } // Hoặc FullName
        public ReactionType ReactionType { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }

    public class PostCommentDTO
    {
        public int PostCommentID { get; set; }
        public int PostID { get; set; }
        public PostUserDTO User { get; set; }
        public int? ParentCommentID { get; set; }
        public string Content { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public int RepliesCount { get; set; }
        public List<PostCommentDTO> Replies { get; set; } // Một vài replies gần nhất, hoặc để null và client fetch riêng
        // Có thể thêm thông tin về reactions cho comment ở đây nếu cần
    }

    public class PostDTO
    {
        public int PostID { get; set; }
        public PostUserDTO User { get; set; }
        public string Content { get; set; }
        public string? ImageUrl { get; set; }
        public string? VideoUrl { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public int TotalReactions { get; set; } // Tổng số reaction
        public Dictionary<ReactionType, int> ReactionCounts { get; set; } // Đếm số lượng cho từng loại reaction
        public ReactionType? CurrentUserReaction { get; set; } // Reaction của user hiện tại (nếu có)
        public int TotalComments { get; set; } // Tổng số comment (bao gồm cả replies)
        public List<PostCommentDTO> Comments { get; set; } // Danh sách comment gốc (không phải replies)
                                                           // Client có thể fetch replies riêng hoặc bạn có thể load sẵn một phần
    }
}