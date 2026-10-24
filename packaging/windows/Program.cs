using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    private static readonly string[] Libraries = {
        "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll"
    };

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            bool verify = args.Length == 2 && args[0] == "--verify";
            string digest;
            using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Game.zip"))
            using (SHA256 hash = SHA256.Create())
                digest = BitConverter.ToString(hash.ComputeHash(stream)).Replace("-", "").Substring(0, 16);
            string folder = verify ? Path.GetFullPath(args[1]) : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OhnoDhses4", digest);
            Extract(folder);
            if (verify)
            {
                if (!File.Exists(Path.Combine(folder, "web", "index.html"))) throw new IOException("Missing game HTML");
                File.WriteAllText(Path.Combine(folder, "verification.txt"), "Embedded game and WebView2 libraries extracted successfully. Build: " + digest);
                return 0;
            }
            AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs ev) {
                string name = new AssemblyName(ev.Name).Name + ".dll";
                if (name != Libraries[0] && name != Libraries[1]) return null;
                return Assembly.LoadFrom(Path.Combine(folder, name));
            };
            Launch(folder);
            return 0;
        }
        catch (Exception ex)
        {
            if (args.Length > 0 && args[0] == "--verify") return 1;
            MessageBox.Show("游戏启动失败：" + ex.Message + "\n\n请确认系统已安装 Microsoft Edge WebView2 Runtime，也可使用 HTML 版。", "四班同学", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }

    private static void Extract(string folder)
    {
        Directory.CreateDirectory(folder);
        string marker = Path.Combine(folder, ".ready");
        if (File.Exists(marker) && File.Exists(Path.Combine(folder, "web", "index.html"))) return;
        foreach (string library in Libraries)
            using (Stream source = Assembly.GetExecutingAssembly().GetManifestResourceStream(library))
            using (Stream target = File.Create(Path.Combine(folder, library))) source.CopyTo(target);
        string web = Path.Combine(folder, "web");
        Directory.CreateDirectory(web);
        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("Game.zip"))
        using (ZipArchive archive = new ZipArchive(resource, ZipArchiveMode.Read))
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                string target = Path.GetFullPath(Path.Combine(web, entry.FullName));
                if (!target.StartsWith(web + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("Invalid package entry");
                if (entry.Name.Length == 0) { Directory.CreateDirectory(target); continue; }
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                using (Stream source = entry.Open())
                using (Stream destination = File.Create(target)) source.CopyTo(destination);
            }
        File.WriteAllText(marker, "ready");
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void Launch(string folder)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        CoreWebView2Environment.SetLoaderDllFolderPath(folder);
        Application.Run(new GameWindow(folder));
    }
}

internal sealed class GameWindow : Form
{
    private readonly WebView2 view = new WebView2();
    private readonly string folder;

    public GameWindow(string folder)
    {
        this.folder = folder;
        Text = "完蛋！我被四班同学包围了 · 四班青春手记";
        Width = 1100; Height = 900;
        MinimumSize = new System.Drawing.Size(420, 600);
        StartPosition = FormStartPosition.CenterScreen;
        view.Dock = DockStyle.Fill;
        Controls.Add(view);
        Shown += Initialize;
        FormClosed += delegate { view.Dispose(); };
    }

    private async void Initialize(object sender, EventArgs args)
    {
        try
        {
            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OhnoDhses4", "WebViewProfile");
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, profile);
            await view.EnsureCoreWebView2Async(environment);
            view.CoreWebView2.SetVirtualHostNameToFolderMapping("dhses4.local", Path.Combine(folder, "web"), CoreWebView2HostResourceAccessKind.DenyCors);
            view.CoreWebView2.Settings.AreDevToolsEnabled = false;
            view.CoreWebView2.Settings.IsStatusBarEnabled = false;
            view.CoreWebView2.Settings.IsWebMessageEnabled = false;
            view.CoreWebView2.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e) {
                Uri uri;
                e.Cancel = !Uri.TryCreate(e.Uri, UriKind.Absolute, out uri) || uri.Scheme != "https" || uri.Host != "dhses4.local";
            };
            view.CoreWebView2.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e) {
                e.Handled = true;
                Uri uri;
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out uri) && uri.Scheme == "https" && uri.Host == "dhses4.local") view.CoreWebView2.Navigate(e.Uri);
            };
            view.CoreWebView2.Navigate("https://dhses4.local/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show("请安装或更新 Microsoft Edge WebView2 Runtime。\n也可直接打开 HTML 版。\n\n" + ex.Message, "运行环境提示");
            Close();
        }
    }
}

