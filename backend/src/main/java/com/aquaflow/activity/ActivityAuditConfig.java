package com.aquaflow.activity;

import com.aquaflow.auth.security.AuthUserDetails;
import org.aopalliance.intercept.MethodInterceptor;
import org.springframework.aop.support.DefaultPointcutAdvisor;
import org.springframework.aop.support.StaticMethodMatcherPointcut;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Optional;

/** Audit approved business commands only. Never serialize request/response bodies or credentials. */
@Configuration
public class ActivityAuditConfig {
    private static final Map<String,String> ENTITIES=Map.ofEntries(
        Map.entry("com.aquaflow.customer.order.application.OrderService","ORDER"),
        Map.entry("com.aquaflow.customer.order.application.OrderDispatchService","DISPATCH"),
        Map.entry("com.aquaflow.inventory.application.InventoryReturnService","INVENTORY_RETURN"),
        Map.entry("com.aquaflow.inventory.application.ProductService","PRODUCT"),
        Map.entry("com.aquaflow.inventory.application.BottleTypeService","BOTTLE_TYPE"),
        Map.entry("com.aquaflow.inventory.application.SupplierService","SUPPLIER"),
        Map.entry("com.aquaflow.inventory.application.PurchaseReceiptService","PURCHASE_RECEIPT"),
        Map.entry("com.aquaflow.customer.application.CustomerService","CUSTOMER"),
        Map.entry("com.aquaflow.customer.application.CustomerAddressService","CUSTOMER_ADDRESS"),
        Map.entry("com.aquaflow.delivery.application.DeliveryService","DELIVERY_TRIP"));
    private static final Map<String,String> LABELS=Map.ofEntries(
        Map.entry("create","Tạo mới"), Map.entry("createForStaff","Tạo đơn tại cửa hàng"),
        Map.entry("createForCustomer","Khách tạo đơn"), Map.entry("createForGuest","Khách vãng lai tạo đơn"),
        Map.entry("update","Cập nhật"), Map.entry("delete","Ngừng sử dụng / xóa"),
        Map.entry("archive","Lưu trữ"), Map.entry("transitionStatus","Đổi trạng thái đơn"),
        Map.entry("dispatch","Xuất kho"), Map.entry("confirm","Xác nhận nhập kho"),
        Map.entry("cancel","Hủy"), Map.entry("assignDriver","Phân tài xế"), Map.entry("addOrder","Thêm đơn vào chuyến"),
        Map.entry("removeOrder","Bỏ đơn khỏi chuyến"), Map.entry("start","Bắt đầu chuyến"),
        Map.entry("recordResult","Ghi kết quả giao hàng"), Map.entry("settle","Kết thúc / đối soát chuyến"));

    @Bean
    @org.springframework.context.annotation.Role(org.springframework.beans.factory.config.BeanDefinition.ROLE_INFRASTRUCTURE)
    public DefaultPointcutAdvisor activityAuditAdvisor(ObjectProvider<PlatformTransactionManager> managers,
                                                      ObjectProvider<ActivityRepository> repositories) {
        var pointcut=new StaticMethodMatcherPointcut() {
            @Override public boolean matches(Method method, Class<?> target) {
                String entity=ENTITIES.get(target.getName());
                if(entity==null) return false;
                if(method.getName().equals("findOrCreateForUser")) return false;
                // These methods already write detailed audit rows inside their transactions.
                if((entity.equals("CUSTOMER") || entity.equals("CUSTOMER_ADDRESS")) && method.getName().equals("update")) return false;
                var tx=AnnotatedElementUtils.findMergedAnnotation(method,Transactional.class);
                return tx!=null && !tx.readOnly();
            }
        };
        MethodInterceptor interceptor=invocation -> {
            var manager=managers.getIfAvailable();
            // MVC tests with mocked repositories deliberately have no persistence transaction manager.
            if(manager==null) return invocation.proceed();
            return new TransactionTemplate(manager).execute(status -> {
                try {
                    Object result=invocation.proceed();
                    Object value=result instanceof Optional<?> optional ? optional.orElse(null) : result;
                    if(result instanceof Optional<?> && value==null || Boolean.FALSE.equals(result)) return result;
                    String entity=ENTITIES.get(org.springframework.aop.support.AopUtils.getTargetClass(invocation.getThis()).getName());
                    Long id=identifier(value);
                    if(id==null && invocation.getArguments().length>0 && invocation.getArguments()[0] instanceof Long first) id=first;
                    if(entity.equals("CUSTOMER_ADDRESS") && invocation.getMethod().getName().equals("delete")
                        && invocation.getArguments().length>1 && invocation.getArguments()[1] instanceof Long addressId) id=addressId;
                    var auth=SecurityContextHolder.getContext().getAuthentication();
                    Long actor=auth!=null && auth.isAuthenticated() && auth.getPrincipal() instanceof AuthUserDetails principal ? principal.user().getId() : null;
                    String method=invocation.getMethod().getName();
                    String description=LABELS.getOrDefault(method,method);
                    if(method.equals("transitionStatus") && invocation.getArguments().length>1)
                        description+=" → "+invocation.getArguments()[1];
                    if(method.equals("recordResult") && invocation.getArguments().length>2
                        && invocation.getArguments()[2] instanceof com.aquaflow.delivery.api.DeliveryDtos.DeliveryResultRequest request)
                        description+=" · đơn #"+invocation.getArguments()[1]+" · "+request.outcome();
                    repositories.getObject().append(actor,method,entity,id,description);
                    return result;
                } catch(RuntimeException | Error error) { throw error; }
                catch(Throwable error) { throw new IllegalStateException("Business command failed",error); }
            });
        };
        var advisor=new DefaultPointcutAdvisor(pointcut,interceptor);
        // Outer transaction encloses both existing service transaction and audit INSERT, independent of advisor ties.
        advisor.setOrder(Ordered.HIGHEST_PRECEDENCE+100);
        return advisor;
    }
    private static Long identifier(Object value) {
        if(value==null) return null;
        try { Object id=value.getClass().getMethod("id").invoke(value); return id instanceof Number n ? n.longValue() : null; }
        catch(ReflectiveOperationException ignored) { return null; }
    }
}
