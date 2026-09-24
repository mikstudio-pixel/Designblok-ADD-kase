import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {}

final class ActivityWindow: UIWindow {
    var onActivity: (() -> Void)?

    override func sendEvent(_ event: UIEvent) {
        if event.allTouches?.contains(where: { [.began, .moved, .ended].contains($0.phase) }) == true {
            onActivity?()
        }
        super.sendEvent(event)
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private let kiosk = KioskViewController()

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = ActivityWindow(windowScene: scene)
        window.rootViewController = kiosk
        window.onActivity = { [weak kiosk] in kiosk?.touchActivity() }
        self.window = window
        window.makeKeyAndVisible()
    }

    func sceneDidBecomeActive(_ scene: UIScene) { kiosk.activate() }
    func sceneWillResignActive(_ scene: UIScene) { kiosk.deactivate() }
    func sceneDidEnterBackground(_ scene: UIScene) { kiosk.suspendNetworking() }
    func sceneDidDisconnect(_ scene: UIScene) { kiosk.deactivate(); kiosk.suspendNetworking() }
}
