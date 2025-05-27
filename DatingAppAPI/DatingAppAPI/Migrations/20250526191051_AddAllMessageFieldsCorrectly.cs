using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DatingAppAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAllMessageFieldsCorrectly : Migration // Giữ nguyên tên này
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Xóa FK cũ để thay đổi OnDelete behavior
            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Users_SenderID",
                table: "Messages");

            // 2. Thay đổi kiểu dữ liệu cột MessageText nếu cần
            migrationBuilder.AlterColumn<string>(
                name: "MessageText",
                table: "Messages",
                type: "nvarchar(1000)", // Hoặc giữ nvarchar(max) nếu bạn muốn
                maxLength: 1000,       // Chỉ cần nếu type là nvarchar(1000)
                nullable: false,       // Giả sử MessageText không được null
                oldClrType: typeof(string),
                oldType: "nvarchar(max)"); // Hoặc oldType là nvarchar(1000) tùy thuộc trạng thái trước đó

            // 3. Thêm các cột MỚI THỰC SỰ (chưa có trong DB theo ảnh)
            migrationBuilder.AddColumn<string>(
                name: "MediaUrl",
                table: "Messages",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>( // MessageType enum
                name: "Type",
                table: "Messages",
                type: "int",
                nullable: false,
                defaultValue: 0); // 0 tương ứng với MessageType.Text

            // Cột ReceiverUserID và IsRead ĐÃ CÓ SẴN trong DB theo ảnh, KHÔNG AddColumn ở đây.

            // 4. Thêm lại FK với OnDelete behavior mới
            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Users_SenderID",
                table: "Messages",
                column: "SenderID",
                principalTable: "Users",
                principalColumn: "UserID",
                onDelete: ReferentialAction.Restrict); // Đổi thành Restrict
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // 1. Xóa FK mới (nếu rollback)
            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Users_SenderID",
                table: "Messages");

            // 2. Xóa các cột đã thêm trong Up()
            migrationBuilder.DropColumn(
                name: "MediaUrl",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "Messages");

            // Cột ReceiverUserID và IsRead đã tồn tại trước migration này,
            // nên không DropColumn chúng ở đây nếu bạn muốn giữ lại chúng khi rollback.
            // Nếu bạn muốn Down() xóa luôn cả ReceiverUserID và IsRead (trở về trạng thái rất cũ)
            // thì mới thêm:
            // migrationBuilder.DropColumn(name: "ReceiverUserID", table: "Messages");
            // migrationBuilder.DropColumn(name: "IsRead", table: "Messages");

            // 3. Hoàn tác AlterColumn MessageText (nếu cần)
            migrationBuilder.AlterColumn<string>(
                name: "MessageText",
                table: "Messages",
                type: "nvarchar(max)", // Quay lại kiểu cũ
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000);

            // 4. Thêm lại FK cũ với OnDelete behavior cũ (Cascade)
            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Users_SenderID",
                table: "Messages",
                column: "SenderID",
                principalTable: "Users",
                principalColumn: "UserID",
                onDelete: ReferentialAction.Cascade); // Quay lại Cascade
        }
    }
}