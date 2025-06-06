﻿// <auto-generated />
using System;
using DatingAppAPI.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

#nullable disable

namespace DatingAppAPI.Migrations
{
    [DbContext(typeof(DatingAppDbContext))]
    [Migration("20250529123829_AddNotificationTable")]
    partial class AddNotificationTable
    {
        /// <inheritdoc />
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "9.0.4")
                .HasAnnotation("Relational:MaxIdentifierLength", 128);

            SqlServerModelBuilderExtensions.UseIdentityColumns(modelBuilder);

            modelBuilder.Entity("DatingAppAPI.DTO.EmailOTP", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("Id"));

                    b.Property<string>("Email")
                        .IsRequired()
                        .HasColumnType("nvarchar(max)");

                    b.Property<DateTimeOffset>("ExpirationTime")
                        .HasColumnType("datetimeoffset");

                    b.Property<bool>("IsUsed")
                        .HasColumnType("bit");

                    b.Property<string>("OtpCode")
                        .IsRequired()
                        .HasColumnType("nvarchar(max)");

                    b.HasKey("Id");

                    b.ToTable("EmailOtps");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Interest", b =>
                {
                    b.Property<int>("InterestId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("InterestId"));

                    b.Property<string>("InterestName")
                        .IsRequired()
                        .HasColumnType("nvarchar(max)");

                    b.HasKey("InterestId");

                    b.ToTable("Interests");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Match", b =>
                {
                    b.Property<int>("MatchID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("MatchID"));

                    b.Property<DateTimeOffset>("MatchTime")
                        .HasColumnType("datetimeoffset");

                    b.Property<int>("User1ID")
                        .HasColumnType("int");

                    b.Property<int>("User2ID")
                        .HasColumnType("int");

                    b.HasKey("MatchID");

                    b.HasIndex("User2ID");

                    b.HasIndex("User1ID", "User2ID")
                        .IsUnique();

                    b.ToTable("Matches");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Message", b =>
                {
                    b.Property<int>("MessageID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("MessageID"));

                    b.Property<bool>("IsRead")
                        .HasColumnType("bit");

                    b.Property<int>("MatchID")
                        .HasColumnType("int");

                    b.Property<string>("MediaUrl")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("MessageText")
                        .IsRequired()
                        .HasMaxLength(1000)
                        .HasColumnType("nvarchar(1000)");

                    b.Property<int>("ReceiverUserID")
                        .HasColumnType("int");

                    b.Property<int>("SenderID")
                        .HasColumnType("int");

                    b.Property<DateTimeOffset>("SentTime")
                        .HasColumnType("datetimeoffset");

                    b.Property<int>("Type")
                        .HasColumnType("int");

                    b.HasKey("MessageID");

                    b.HasIndex("MatchID");

                    b.HasIndex("SenderID");

                    b.ToTable("Messages");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Notification", b =>
                {
                    b.Property<int>("NotificationID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("NotificationID"));

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("datetimeoffset");

                    b.Property<bool>("IsRead")
                        .HasColumnType("bit");

                    b.Property<string>("MessageText")
                        .IsRequired()
                        .HasMaxLength(255)
                        .HasColumnType("nvarchar(255)");

                    b.Property<int>("RecipientUserID")
                        .HasColumnType("int");

                    b.Property<int?>("ReferenceID")
                        .HasColumnType("int");

                    b.Property<int?>("SenderUserID")
                        .HasColumnType("int");

                    b.Property<int>("Type")
                        .HasColumnType("int");

                    b.HasKey("NotificationID");

                    b.HasIndex("RecipientUserID");

                    b.HasIndex("SenderUserID");

                    b.ToTable("Notifications");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Photo", b =>
                {
                    b.Property<int>("PhotoID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("PhotoID"));

                    b.Property<string>("PhotoURL")
                        .IsRequired()
                        .HasColumnType("nvarchar(max)");

                    b.Property<int>("UserID")
                        .HasColumnType("int");

                    b.HasKey("PhotoID");

                    b.HasIndex("UserID");

                    b.ToTable("Photos");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Post", b =>
                {
                    b.Property<int>("PostID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("PostID"));

                    b.Property<string>("Content")
                        .IsRequired()
                        .HasColumnType("nvarchar(max)");

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("datetimeoffset");

                    b.Property<string>("ImageUrl")
                        .HasColumnType("nvarchar(max)");

                    b.Property<DateTimeOffset?>("UpdatedAt")
                        .HasColumnType("datetimeoffset");

                    b.Property<int>("UserID")
                        .HasColumnType("int");

                    b.Property<string>("VideoUrl")
                        .HasColumnType("nvarchar(max)");

                    b.HasKey("PostID");

                    b.HasIndex("UserID");

                    b.ToTable("Posts");
                });

            modelBuilder.Entity("DatingAppAPI.Models.PostComment", b =>
                {
                    b.Property<int>("PostCommentID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("PostCommentID"));

                    b.Property<string>("Content")
                        .IsRequired()
                        .HasMaxLength(1000)
                        .HasColumnType("nvarchar(1000)");

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("datetimeoffset");

                    b.Property<int?>("ParentCommentID")
                        .HasColumnType("int");

                    b.Property<int>("PostID")
                        .HasColumnType("int");

                    b.Property<DateTimeOffset?>("UpdatedAt")
                        .HasColumnType("datetimeoffset");

                    b.Property<int>("UserID")
                        .HasColumnType("int");

                    b.HasKey("PostCommentID");

                    b.HasIndex("ParentCommentID");

                    b.HasIndex("PostID");

                    b.HasIndex("UserID");

                    b.ToTable("PostComments");
                });

            modelBuilder.Entity("DatingAppAPI.Models.PostReaction", b =>
                {
                    b.Property<int>("PostReactionID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("PostReactionID"));

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("datetimeoffset");

                    b.Property<int>("PostID")
                        .HasColumnType("int");

                    b.Property<int>("ReactionType")
                        .HasColumnType("int");

                    b.Property<int>("UserID")
                        .HasColumnType("int");

                    b.HasKey("PostReactionID");

                    b.HasIndex("PostID");

                    b.HasIndex("UserID");

                    b.ToTable("PostReactions");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Swipe", b =>
                {
                    b.Property<int>("SwipeID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("SwipeID"));

                    b.Property<int>("FromUserID")
                        .HasColumnType("int");

                    b.Property<bool>("IsLike")
                        .HasColumnType("bit");

                    b.Property<DateTimeOffset>("SwipeTime")
                        .HasColumnType("datetimeoffset");

                    b.Property<int>("ToUserID")
                        .HasColumnType("int");

                    b.HasKey("SwipeID");

                    b.HasIndex("FromUserID");

                    b.HasIndex("ToUserID");

                    b.ToTable("Swipes");
                });

            modelBuilder.Entity("DatingAppAPI.Models.User", b =>
                {
                    b.Property<int>("UserID")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("int");

                    SqlServerPropertyBuilderExtensions.UseIdentityColumn(b.Property<int>("UserID"));

                    b.Property<int?>("AccountStatus")
                        .HasColumnType("int");

                    b.Property<string>("Address")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("Avatar")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("Bio")
                        .HasColumnType("nvarchar(max)");

                    b.Property<DateTimeOffset?>("Birthdate")
                        .HasColumnType("datetimeoffset");

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("datetimeoffset");

                    b.Property<string>("Email")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("FacebookID")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("FullName")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("Gender")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("GoogleID")
                        .HasColumnType("nvarchar(max)");

                    b.Property<bool>("IsEmailVerified")
                        .HasColumnType("bit");

                    b.Property<DateTimeOffset?>("LastLoginDate")
                        .HasColumnType("datetimeoffset");

                    b.Property<decimal?>("Latitude")
                        .HasColumnType("decimal(18,2)");

                    b.Property<decimal?>("Longitude")
                        .HasColumnType("decimal(18,2)");

                    b.Property<string>("PasswordHash")
                        .IsRequired()
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("PhoneNumber")
                        .HasColumnType("nvarchar(max)");

                    b.Property<int?>("ProfileVisibility")
                        .HasColumnType("int");

                    b.Property<string>("Username")
                        .IsRequired()
                        .HasColumnType("nvarchar(max)");

                    b.HasKey("UserID");

                    b.ToTable("Users");
                });

            modelBuilder.Entity("DatingAppAPI.Models.UserInterest", b =>
                {
                    b.Property<int>("UserId")
                        .HasColumnType("int");

                    b.Property<int>("InterestId")
                        .HasColumnType("int");

                    b.HasKey("UserId", "InterestId");

                    b.HasIndex("InterestId");

                    b.ToTable("UserInterests");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Match", b =>
                {
                    b.HasOne("DatingAppAPI.Models.User", "User1")
                        .WithMany("Matches1")
                        .HasForeignKey("User1ID")
                        .OnDelete(DeleteBehavior.NoAction)
                        .IsRequired();

                    b.HasOne("DatingAppAPI.Models.User", "User2")
                        .WithMany("Matches2")
                        .HasForeignKey("User2ID")
                        .OnDelete(DeleteBehavior.NoAction)
                        .IsRequired();

                    b.Navigation("User1");

                    b.Navigation("User2");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Message", b =>
                {
                    b.HasOne("DatingAppAPI.Models.Match", "Match")
                        .WithMany("Messages")
                        .HasForeignKey("MatchID")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("DatingAppAPI.Models.User", "Sender")
                        .WithMany("Messages")
                        .HasForeignKey("SenderID")
                        .OnDelete(DeleteBehavior.Restrict)
                        .IsRequired();

                    b.Navigation("Match");

                    b.Navigation("Sender");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Notification", b =>
                {
                    b.HasOne("DatingAppAPI.Models.User", "RecipientUser")
                        .WithMany()
                        .HasForeignKey("RecipientUserID")
                        .OnDelete(DeleteBehavior.Restrict)
                        .IsRequired();

                    b.HasOne("DatingAppAPI.Models.User", "SenderUser")
                        .WithMany()
                        .HasForeignKey("SenderUserID")
                        .OnDelete(DeleteBehavior.Restrict);

                    b.Navigation("RecipientUser");

                    b.Navigation("SenderUser");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Photo", b =>
                {
                    b.HasOne("DatingAppAPI.Models.User", "User")
                        .WithMany("Photos")
                        .HasForeignKey("UserID")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("User");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Post", b =>
                {
                    b.HasOne("DatingAppAPI.Models.User", "User")
                        .WithMany("Posts")
                        .HasForeignKey("UserID")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("User");
                });

            modelBuilder.Entity("DatingAppAPI.Models.PostComment", b =>
                {
                    b.HasOne("DatingAppAPI.Models.PostComment", "ParentComment")
                        .WithMany("Replies")
                        .HasForeignKey("ParentCommentID")
                        .OnDelete(DeleteBehavior.Restrict);

                    b.HasOne("DatingAppAPI.Models.Post", "Post")
                        .WithMany("Comments")
                        .HasForeignKey("PostID")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("DatingAppAPI.Models.User", "User")
                        .WithMany("PostComments")
                        .HasForeignKey("UserID")
                        .OnDelete(DeleteBehavior.Restrict)
                        .IsRequired();

                    b.Navigation("ParentComment");

                    b.Navigation("Post");

                    b.Navigation("User");
                });

            modelBuilder.Entity("DatingAppAPI.Models.PostReaction", b =>
                {
                    b.HasOne("DatingAppAPI.Models.Post", "Post")
                        .WithMany("Reactions")
                        .HasForeignKey("PostID")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("DatingAppAPI.Models.User", "User")
                        .WithMany("PostReactions")
                        .HasForeignKey("UserID")
                        .OnDelete(DeleteBehavior.Restrict)
                        .IsRequired();

                    b.Navigation("Post");

                    b.Navigation("User");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Swipe", b =>
                {
                    b.HasOne("DatingAppAPI.Models.User", "FromUser")
                        .WithMany("SwipesMade")
                        .HasForeignKey("FromUserID")
                        .OnDelete(DeleteBehavior.NoAction)
                        .IsRequired();

                    b.HasOne("DatingAppAPI.Models.User", "ToUser")
                        .WithMany("SwipesReceived")
                        .HasForeignKey("ToUserID")
                        .OnDelete(DeleteBehavior.NoAction)
                        .IsRequired();

                    b.Navigation("FromUser");

                    b.Navigation("ToUser");
                });

            modelBuilder.Entity("DatingAppAPI.Models.UserInterest", b =>
                {
                    b.HasOne("DatingAppAPI.Models.Interest", "Interest")
                        .WithMany("UserInterests")
                        .HasForeignKey("InterestId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("DatingAppAPI.Models.User", "User")
                        .WithMany("UserInterests")
                        .HasForeignKey("UserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("Interest");

                    b.Navigation("User");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Interest", b =>
                {
                    b.Navigation("UserInterests");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Match", b =>
                {
                    b.Navigation("Messages");
                });

            modelBuilder.Entity("DatingAppAPI.Models.Post", b =>
                {
                    b.Navigation("Comments");

                    b.Navigation("Reactions");
                });

            modelBuilder.Entity("DatingAppAPI.Models.PostComment", b =>
                {
                    b.Navigation("Replies");
                });

            modelBuilder.Entity("DatingAppAPI.Models.User", b =>
                {
                    b.Navigation("Matches1");

                    b.Navigation("Matches2");

                    b.Navigation("Messages");

                    b.Navigation("Photos");

                    b.Navigation("PostComments");

                    b.Navigation("PostReactions");

                    b.Navigation("Posts");

                    b.Navigation("SwipesMade");

                    b.Navigation("SwipesReceived");

                    b.Navigation("UserInterests");
                });
#pragma warning restore 612, 618
        }
    }
}
