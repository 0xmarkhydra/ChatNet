using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;

internal static class Screenshot
{
    [DllImport("user32.dll")]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("shcore.dll")]
    private static extern int SetProcessDpiAwareness(int value);
    [DllImport("dwmapi.dll")]
    private static extern int DwmFlush();

    private static int Main(string[] args)
    {
        if (args.Length != 4) return 2;
        int[] b = new int[4];
        for (int i = 0; i < b.Length; ++i)
            if (!int.TryParse(args[i], NumberStyles.Integer, CultureInfo.InvariantCulture, out b[i])) return 2;
        int width = b[2], height = b[3];
        if (Math.Abs((long)b[0]) > 65536 || Math.Abs((long)b[1]) > 65536 ||
            width < 2 || height < 2 || width > 16384 || height > 16384 || (long)width * height > 40L * 1024 * 1024) return 2;

        try
        {
            try
            {
                if (!SetProcessDpiAwarenessContext(new IntPtr(-4))) SetProcessDpiAwareness(2);
            }
            catch (EntryPointNotFoundException) { SetProcessDpiAwareness(2); }

            // Wait for the compositor instead of sleeping after hiding SocCO.
            if (DwmFlush() != 0) return 3;
            using (var image = new Bitmap(width, height, PixelFormat.Format32bppRgb))
            {
                using (var g = Graphics.FromImage(image))
                {
                    g.CopyFromScreen(b[0], b[1], 0, 0, new Size(width, height), CopyPixelOperation.SourceCopy);
                }
                var data = image.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppRgb);
                try
                {
                    using (var output = new BufferedStream(Console.OpenStandardOutput(), 65536))
                    {
                        var row = new byte[width * 4];
                        for (int y = 0; y < height; ++y)
                        {
                            Marshal.Copy(IntPtr.Add(data.Scan0, y * data.Stride), row, 0, row.Length);
                            for (int x = 3; x < row.Length; x += 4) row[x] = 255;
                            output.Write(row, 0, row.Length);
                        }
                    }
                }
                finally { image.UnlockBits(data); }
            }
            return 0;
        }
        catch { return 3; }
    }
}
