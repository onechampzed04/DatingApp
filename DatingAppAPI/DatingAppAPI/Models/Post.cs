using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DatingAppAPI.Models
{
    public enum ReactionType
    {
        Like = 1,
        Love = 2,
        Haha = 3,
        Wow = 4,
        Sad = 5,
        Angry = 6
    }

    public class PostReaction
    {
        [Key]
        public int PostReactionID { get; set; }

        [Required]
        public int PostID { get; set; }
        public virtual Post Post { get; set; }

        [Required]
        public int UserID { get; set; }
        public virtual User User { get; set; }

        [Required]
        public ReactionType ReactionType { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    public class PostComment
    {
        [Key]
        public int PostCommentID { get; set; }

        [Required]
        public int PostID { get; set; }
        public virtual Post Post { get; set; }

        [Required]
        public int UserID { get; set; }
        public virtual User User { get; set; }

        public int? ParentCommentID { get; set; } // For threaded comments/replies
        [ForeignKey("ParentCommentID")]
        public virtual PostComment ParentComment { get; set; }

        [Required]
        [MaxLength(1000)]
        public string Content { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset? UpdatedAt { get; set; }

        public virtual ICollection<PostComment> Replies { get; set; } // Replies to this comment

        public PostComment()
        {
            Replies = new HashSet<PostComment>();
        }
    }


    public class Post
    {
        [Key]
        public int PostID { get; set; }

        [Required]
        public int UserID { get; set; }
        public virtual User User { get; set; }

        public string Content { get; set; }
        public string? ImageUrl { get; set; } // Đường dẫn đến ảnh của bài viết
        public string? VideoUrl { get; set; } // Đường dẫn đến video của bài viết

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset? UpdatedAt { get; set; }

        public virtual ICollection<PostReaction> Reactions { get; set; }
        public virtual ICollection<PostComment> Comments { get; set; }

        public Post()
        {
            Reactions = new HashSet<PostReaction>();
            Comments = new HashSet<PostComment>();
        }
    }
}